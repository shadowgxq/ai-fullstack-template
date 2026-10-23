"""Account-serialized recommendation lifecycle; all AI HTTP happens after commit."""

import base64
from collections.abc import Callable
import hashlib
import hmac
import json
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

from pydantic import JsonValue

from app.core.exceptions import BusinessException
from app.core.session import transaction
from app.models.account_revision import AccountRevision
from app.models.garment import Garment
from app.models.recommendation import RecommendationRequest
from app.repositories.preferences_repository import PreferencesRepository
from app.repositories.recommendation_repository import RecommendationRepository
from app.repositories.revision_repository import RevisionRepository
from app.repositories.wear_repository import WearRepository
from app.schemas.garment import GarmentView
from app.schemas.recommendation import (
    RecommendationCandidates,
    RecommendationCreate,
    RecommendationSelection,
    RecommendationView,
)
from app.services.ai_runtime_client import AiRuntimeClient, AiRuntimeError
from app.services.preferences_service import PreferencesService
from app.services import recommendation_rules as rules
from app.services.weather_service import WeatherService
from app.services.weather_time import SHANGHAI

ACTIVE = {"dispatch_pending", "generating"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def canonical(value: object) -> str:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )


def aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class RecommendationService:
    def __init__(
        self,
        repo: RecommendationRepository,
        revisions: RevisionRepository,
        preferences: PreferencesRepository,
        wears: WearRepository,
        weather: WeatherService,
        ai: AiRuntimeClient,
        cursor_secret: str,
        *,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self.repo, self.revisions, self.preferences, self.wears = (
            repo,
            revisions,
            preferences,
            wears,
        )
        self.weather, self.ai, self.secret, self.clock = (
            weather,
            ai,
            cursor_secret.encode(),
            clock,
        )

    def _required(self, owner_id: int, request_id: UUID) -> RecommendationRequest:
        row = self.repo.get(owner_id, request_id, lock=True)
        if row is None:
            raise BusinessException(40480, "Recommendation not found", 404)
        return row

    def _preferences(self, owner_id: int) -> dict[str, JsonValue]:
        view = PreferencesService._view(self.preferences.get_by_owner_id(owner_id))
        return view.model_dump(exclude={"version", "catalog_version"})

    @staticmethod
    def _revisions(revision: AccountRevision) -> dict[str, int]:
        return {
            field: getattr(revision, field)
            for field in (
                "inventory_revision",
                "history_revision",
                "preferences_revision",
            )
        }

    def _freeze(
        self, owner_id: int, payload: RecommendationCreate, revision: AccountRevision
    ) -> tuple[dict[str, JsonValue], int, int]:
        total, inventory = self.repo.inventory(owner_id)
        preferences = self._preferences(owner_id)
        today = self.clock().astimezone(SHANGHAI).date()
        start = today - timedelta(days=29)
        _, history_rows = self.wears.history_summary(owner_id, start, today)
        history = {
            str(gid): {
                "garment_id": str(gid),
                "wear_count": count,
                "last_worn_on": last.isoformat(),
            }
            for gid, count, last in history_rows
        }
        eligible = rules.ranked(inventory, preferences, payload.scene, history)
        candidates = eligible[: rules.CANDIDATE_LIMIT]
        weather = {
            "state": "missing",
            "context_id": None,
            "region_id": None,
            "weather_date": today.isoformat(),
            "facts": None,
            "missing_reason": "not_requested",
        }
        if payload.weather_context_id:
            context = self.weather.get_owned_context_in_transaction(
                owner_id, payload.weather_context_id
            )
            weather = {
                "state": context.state,
                "context_id": str(context.context_id),
                "region_id": context.region.region_id,
                "weather_date": context.weather_date.isoformat(),
                "facts": context.facts.model_dump(mode="json")
                if context.facts
                else None,
                "missing_reason": context.missing_reason,
            }
        frozen = {
            "candidates": [rules.candidate(item) for item in candidates],
            "preferences": preferences,
            "scene": payload.scene,
            "history": {
                "start_date": start.isoformat(),
                "end_date": today.isoformat(),
                "garments": [
                    history.get(
                        str(item.id),
                        {
                            "garment_id": str(item.id),
                            "wear_count": 0,
                            "last_worn_on": None,
                        },
                    )
                    for item in candidates
                ],
            },
            "weather": weather,
            "revisions": self._revisions(revision),
            "versions": {
                "catalog_version": "1",
                "policy_version": "wardrobe.filter.v1",
                "prompt_version": "wardrobe.recommend.prompt.v1",
                "schema_version": "wardrobe.recommend.output.v1",
            },
            "fact_refs": [],
            "candidate_scope_limited": len(eligible) > rules.CANDIDATE_LIMIT,
        }
        frozen["fact_refs"] = rules.facts(frozen)
        # No attribute, avoidance or free text is truncated to satisfy capacity.
        if len(canonical(frozen).encode()) > 512 * 1024:
            raise BusinessException(42280, "Recommendation input exceeds capacity", 422)
        return frozen, total, len(eligible)

    def _fresh(self, row: RecommendationRequest, revision: AccountRevision) -> bool:
        if row.frozen_input["revisions"] != self._revisions(revision):
            row.status, row.error_code = "stale", "input_changed"
            return False
        if row.frozen_input["weather"]["state"] == "available":
            try:
                self.weather.get_owned_context_in_transaction(
                    row.owner_id, row.weather_context_id
                )
            except BusinessException:
                row.status, row.error_code = "stale", "weather_expired"
                return False
        if row.result is not None:
            try:
                self._garments(
                    row, [UUID(value) for value in row.result["selected_ids"]]
                )
            except (BusinessException, ValueError, KeyError):
                row.status, row.error_code = "stale", "input_changed"
                return False
        return True

    def _garments(
        self, row: RecommendationRequest, selected_ids: list[UUID]
    ) -> list[Garment]:
        _, inventory = self.repo.inventory(row.owner_id)
        by_id = {item.id: item for item in inventory}
        preferences = self._preferences(row.owner_id)
        if any(
            gid not in by_id or not rules.allowed(by_id[gid], preferences)
            for gid in selected_ids
        ):
            raise BusinessException(
                42280, "Selection contains unavailable garments", 422
            )
        return [by_id[gid] for gid in selected_ids]

    def _selection(
        self, row: RecommendationRequest, ids: list[UUID]
    ) -> RecommendationSelection:
        garments = self._garments(row, ids)
        # Replacements may be outside the 16 model candidates. Rebuild history
        # for this complete selection within the original frozen date window.
        history = row.frozen_input["history"]
        _, summaries = self.wears.history_summary(
            row.owner_id,
            date.fromisoformat(history["start_date"]),
            date.fromisoformat(history["end_date"]),
        )
        selected = set(ids)
        payload = {
            **row.frozen_input,
            "history": {
                **history,
                "garments": [
                    {
                        "garment_id": str(gid),
                        "wear_count": count,
                        "last_worn_on": last.isoformat(),
                    }
                    for gid, count, last in summaries
                    if gid in selected
                ],
            },
        }
        reasons, limitations = rules.explanations(payload, garments)
        return RecommendationSelection(
            request_id=row.id,
            selected_ids=ids,
            garments=[GarmentView.model_validate(item) for item in garments],
            reasons=reasons,
            limitations=limitations,
        )

    def _view(self, row: RecommendationRequest) -> RecommendationView:
        _, limitations = rules.explanations(row.frozen_input, [])
        if row.outcome == "no_inventory":
            limitations.insert(0, "衣柜暂无衣物，请先录入。")
        elif row.outcome == "no_candidates":
            limitations.insert(
                0, "当前没有满足可穿状态与明确避免条件的衣物；属性不足也会被排除。"
            )
        result = (
            self._selection(row, [UUID(item) for item in row.result["selected_ids"]])
            if row.status == "ready" and row.outcome == "recommendation"
            else None
        )
        return RecommendationView(
            request_id=row.id,
            status=row.status,
            scene=row.scene,
            outcome=row.outcome,
            error_code=row.error_code,
            inventory_count=row.inventory_count,
            eligible_count=row.eligible_count,
            candidate_scope_limited=row.frozen_input["candidate_scope_limited"],
            limitations=limitations,
            result=result,
            created_at=aware(row.created_at),
            deadline_at=aware(row.deadline_at),
        )

    def create(
        self, owner_id: int, payload: RecommendationCreate, key: str
    ) -> RecommendationView:
        digest = hashlib.sha256(
            canonical(payload.model_dump(mode="json")).encode()
        ).hexdigest()
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            row = self.repo.by_key(owner_id, key)
            if row:
                if row.request_hash != digest:
                    raise BusinessException(
                        40980, "Idempotency key was used with different content", 409
                    )
                if row.status == "ready":
                    self._fresh(row, revision)
                return self._view(row)
            frozen, total, eligible = self._freeze(owner_id, payload, revision)
            row = self.repo.create(
                RecommendationRequest(
                    owner_id=owner_id,
                    request_key=key,
                    request_hash=digest,
                    scene=payload.scene,
                    weather_context_id=payload.weather_context_id,
                    frozen_input=frozen,
                    inventory_count=total,
                    eligible_count=eligible,
                    status="dispatch_pending" if eligible else "ready",
                    outcome=None
                    if eligible
                    else ("no_inventory" if total == 0 else "no_candidates"),
                    created_at=self.clock(),
                    deadline_at=self.clock() + timedelta(minutes=5),
                )
            )
            if eligible:
                self.repo.command(row.id, "create", self.clock())
            return self._view(row)

    def _apply_run(
        self,
        row: RecommendationRequest,
        run: dict[str, JsonValue],
        revision: AccountRevision,
    ) -> None:
        if row.status not in ACTIVE:
            return
        if aware(row.deadline_at) <= self.clock():
            row.status, row.error_code = "failed", "deadline_exceeded"
            self.repo.command(row.id, "cancel", self.clock())
            return
        if not self._fresh(row, revision):
            self.repo.command(row.id, "cancel", self.clock())
            return
        if run["status"] == "completed":
            try:
                selected = rules.validate_output(row.frozen_input, run["output"])
                self._selection(row, [UUID(value) for value in selected])
            except (ValueError, TypeError, KeyError, BusinessException):
                row.status, row.error_code = "failed", "invalid_output"
            else:
                row.status, row.outcome, row.result = (
                    "ready",
                    "recommendation",
                    {"selected_ids": selected},
                )
        elif run["status"] == "failed":
            row.status = "failed"
            row.error_code = (
                run["error_code"]
                if run["error_code"]
                in {
                    "invalid_output",
                    "call_outcome_unknown",
                    "model_not_configured",
                    "provider_error",
                }
                else "ai_execution_failed"
            )
        elif run["status"] == "cancelled":
            row.status, row.error_code = "cancelled", "runtime_cancelled"
        else:
            row.status = "generating"

    def get(self, owner_id: int, request_id: UUID) -> RecommendationView:
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            row = self._required(owner_id, request_id)
            if row.status == "ready":
                self._fresh(row, revision)
            if row.status in ACTIVE and aware(row.deadline_at) <= self.clock():
                row.status, row.error_code = "failed", "deadline_exceeded"
                self.repo.command(row.id, "cancel", self.clock())
            run_id, frozen = row.ai_run_id, row.frozen_input
            if row.status not in ACTIVE or run_id is None:
                return self._view(row)
        # Authentication reads and all business SELECT autobegins have ended.
        try:
            run, error = self.ai.get_run(str(run_id), frozen), None
        except AiRuntimeError as exc:
            run, error = None, exc
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            row = self._required(owner_id, request_id)
            if row.status in ACTIVE:
                if error and not error.retryable:
                    row.status, row.error_code = "failed", error.code
                    self.repo.command(row.id, "cancel", self.clock())
                elif run:
                    self._apply_run(row, run, revision)
            return self._view(row)

    def cancel(self, owner_id: int, request_id: UUID) -> RecommendationView:
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            row = self._required(owner_id, request_id)
            if row.status == "ready":
                self._fresh(row, revision)
            if row.status in ACTIVE:
                row.status, row.error_code = "cancelled", "user_cancelled"
                # Keep create intent: a remote Run may exist before local mapping.
                self.repo.command(row.id, "cancel", self.clock())
            return self._view(row)

    def validate_locked(
        self, owner_id: int, request_id: UUID, ids: list[UUID]
    ) -> RecommendationSelection:
        revision = self.revisions.lock(owner_id)
        row = self._required(owner_id, request_id)
        if row.status == "ready":
            self._fresh(row, revision)
        if row.status == "stale":
            raise BusinessException(
                40982, "Recommendation basis changed; generate again", 409
            )
        if row.status != "ready" or row.outcome != "recommendation":
            raise BusinessException(40981, "Recommendation is not available", 409)
        if not ids or len(ids) > 64 or len(ids) != len(set(ids)):
            raise BusinessException(42280, "Invalid complete selection", 422)
        return self._selection(row, ids)

    def validate_selection(
        self, owner_id: int, request_id: UUID, ids: list[UUID]
    ) -> RecommendationSelection:
        with transaction(self.repo.db):
            return self.validate_locked(owner_id, request_id, ids)

    def candidates(
        self,
        owner_id: int,
        request_id: UUID,
        excluded: list[UUID],
        cursor: str | None,
        page_size: int,
    ) -> RecommendationCandidates:
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            row = self._required(owner_id, request_id)
            if row.status == "ready":
                self._fresh(row, revision)
            if row.status != "ready" or row.outcome != "recommendation":
                raise BusinessException(
                    40982 if row.status == "stale" else 40981,
                    "Recommendation is not available",
                    409,
                )
            binding = {
                "owner": owner_id,
                "request": str(request_id),
                "revisions": self._revisions(revision),
                "excluded": sorted(str(item) for item in set(excluded)),
            }
            offset = 0
            if cursor:
                try:
                    encoded, signature = cursor.split(".")
                    if not hmac.compare_digest(
                        signature,
                        hmac.new(
                            self.secret, encoded.encode(), hashlib.sha256
                        ).hexdigest(),
                    ):
                        raise ValueError()
                    data = json.loads(
                        base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
                    )
                    if (
                        data["binding"] != binding
                        or type(data["offset"]) is not int
                        or data["offset"] < 0
                    ):
                        raise ValueError()
                    offset = data["offset"]
                except (ValueError, KeyError, TypeError, UnicodeDecodeError):
                    raise BusinessException(
                        42281, "Invalid replacement cursor", 422
                    ) from None
            _, inventory = self.repo.inventory(owner_id)
            window = row.frozen_input["history"]
            _, summaries = self.wears.history_summary(
                owner_id,
                date.fromisoformat(window["start_date"]),
                date.fromisoformat(window["end_date"]),
            )
            history = {
                str(gid): {"wear_count": count, "last_worn_on": last.isoformat()}
                for gid, count, last in summaries
            }
            ordered = [
                item
                for item in rules.ranked(
                    inventory, self._preferences(owner_id), row.scene, history
                )
                if item.id not in excluded
            ]
            page = ordered[offset : offset + page_size]
            next_cursor = None
            if len(ordered) > offset + page_size:
                encoded = (
                    base64.urlsafe_b64encode(
                        canonical(
                            {"binding": binding, "offset": offset + page_size}
                        ).encode()
                    )
                    .decode()
                    .rstrip("=")
                )
                next_cursor = (
                    encoded
                    + "."
                    + hmac.new(
                        self.secret, encoded.encode(), hashlib.sha256
                    ).hexdigest()
                )
            return RecommendationCandidates(
                items=[GarmentView.model_validate(item) for item in page],
                next_cursor=next_cursor,
            )

    def dispatch_once(self) -> bool:
        now = self.clock()
        with transaction(self.repo.db):
            due = self.repo.due_ids(now, 1)
        if not due:
            return False
        owner_id, request_id, command_id = due[0]
        with transaction(self.repo.db):
            self.revisions.lock(owner_id)
            row = self._required(owner_id, request_id)
            command = self.repo.lock_command(command_id)
            if (
                command.state == "done"
                or aware(command.available_at) > now
                or (command.lease_until and aware(command.lease_until) > now)
            ):
                return False
            token = uuid4()
            command.state, command.lease_token, command.lease_until = (
                "leased",
                token,
                now + timedelta(seconds=30),
            )
            command.attempts += 1
            kind, frozen, run_id = command.kind, row.frozen_input, row.ai_run_id
            if row.status in ACTIVE and aware(row.deadline_at) <= now:
                row.status, row.error_code = "failed", "deadline_exceeded"
                self.repo.command(row.id, "cancel", self.clock())
            cancel_intent = kind == "cancel" or row.status not in ACTIVE
        try:
            if cancel_intent:
                run = (
                    self.ai.cancel_run(str(run_id), frozen)
                    if run_id
                    else self.ai.cancel_by_key(f"wardrobe:{request_id}", frozen)
                )
            else:
                run = self.ai.create_run(f"wardrobe:{request_id}", frozen)
            error = None
        except AiRuntimeError as exc:
            run, error = None, exc
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            row = self._required(owner_id, request_id)
            command = self.repo.lock_command(command_id)
            if (
                command.lease_token != token
                or aware(command.lease_until) <= self.clock()
            ):
                return True
            command.lease_token, command.lease_until = None, None
            if error:
                command.last_error = error.code
                # Cleanup intent survives even a configuration/protocol failure:
                # operators may repair that dependency while a known Run exists.
                if error.retryable or cancel_intent:
                    command.state, command.available_at = (
                        "pending",
                        self.clock()
                        + timedelta(seconds=min(60, 2 ** min(command.attempts, 6))),
                    )
                else:
                    command.state = "done"
                    if row.status in ACTIVE:
                        row.status, row.error_code = "failed", error.code
                        if error.code != "ai_not_configured":
                            self.repo.command(row.id, "cancel", self.clock())
                return True
            command.state, command.last_error = "done", None
            if kind == "create" or row.ai_run_id is None:
                mapped = UUID(run["run_id"])
                if row.ai_run_id is not None and row.ai_run_id != mapped:
                    row.status, row.error_code = "failed", "ai_identity_mismatch"
                    return True
                row.ai_run_id = mapped
                if row.status not in ACTIVE:
                    if run["status"] in {"queued", "running"}:
                        self.repo.command(row.id, "cancel", self.clock())
                else:
                    self._apply_run(row, run, revision)
            return True
