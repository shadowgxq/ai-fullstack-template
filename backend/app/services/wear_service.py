import base64
from collections.abc import Callable
from datetime import date, datetime, timezone
import hashlib
import hmac
import json
from uuid import UUID
from zoneinfo import ZoneInfo

from app.core.exceptions import BusinessException
from app.core.session import transaction
from app.models.wear_record import WearRecord, WearRecordItem
from app.repositories.garment_repository import GarmentRepository
from app.repositories.idempotency_repository import IdempotencyRepository
from app.repositories.revision_repository import RevisionRepository
from app.repositories.wear_repository import WearRepository
from app.services.recommendation_service import RecommendationService
from app.schemas.wear import (
    GarmentHistorySummary,
    HistorySummary,
    WearCreate,
    WearCreated,
    WearDeleted,
    WearItem,
    WearList,
    WearPatch,
    WearView,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


class WearService:
    def __init__(
        self,
        repo: WearRepository,
        garments: GarmentRepository,
        revisions: RevisionRepository,
        receipts: IdempotencyRepository,
        cursor_secret: str,
        clock: Callable[[], datetime] = utc_now,
        *,
        recommendations: RecommendationService,
    ) -> None:
        self.repo = repo
        self.garments = garments
        self.revisions = revisions
        self.receipts = receipts
        self.cursor_secret = cursor_secret.encode()
        self.clock = clock
        self.recommendations = recommendations

    def _validate_date(self, wear_date: date) -> None:
        if wear_date > self.clock().astimezone(ZoneInfo("Asia/Shanghai")).date():
            raise BusinessException(42230, "Wear date cannot be in the future", 422)

    def _view(self, record: WearRecord, items: list[WearRecordItem]) -> WearView:
        return WearView(
            id=record.id,
            wear_date=record.wear_date,
            version=record.version,
            created_at=record.created_at,
            updated_at=record.updated_at,
            items=[
                WearItem.model_validate(item)
                for item in sorted(items, key=lambda item: item.garment_id)
            ],
            recommendation_request_id=record.recommendation_request_id,
        )

    def create(self, owner_id: int, payload: WearCreate, key: str) -> WearCreated:
        content = payload.model_dump(mode="json")
        # Existing manual receipts predate the optional source field. Preserve
        # their exact canonical identity; a real source always participates.
        if payload.recommendation_request_id is None:
            content.pop("recommendation_request_id")
        payload_hash = hashlib.sha256(_canonical(content).encode()).hexdigest()
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            receipt = self.receipts.get(owner_id, "wear-record.create", key)
            if receipt is not None:
                if receipt.payload_hash != payload_hash:
                    raise BusinessException(
                        40930, "Idempotency key was used with different content", 409
                    )
                if self.repo.tombstone(owner_id, receipt.resource_id) is not None:
                    raise BusinessException(40931, "Wear record was deleted", 409)
                return WearCreated.model_validate(receipt.response_json)
            self._validate_date(payload.wear_date)
            if payload.recommendation_request_id is not None:
                self.recommendations.validate_locked(
                    owner_id, payload.recommendation_request_id, payload.garment_ids
                )
            selected = []
            for garment_id in payload.garment_ids:
                garment = self.garments.get_owned(owner_id, garment_id, lock=True)
                if garment is None:
                    raise BusinessException(40430, "Garment not found", 404)
                selected.append(garment)
            record = self.repo.create(
                WearRecord(
                    owner_id=owner_id,
                    wear_date=payload.wear_date,
                    recommendation_request_id=payload.recommendation_request_id,
                )
            )
            for garment in selected:
                self.repo.add_item(
                    WearRecordItem(
                        record_id=record.id,
                        garment_id=garment.id,
                        name_snapshot=garment.name,
                        category_snapshot=garment.category,
                    )
                )
            response = WearCreated(id=record.id, version=record.version)
            self.receipts.create(
                owner_id,
                "wear-record.create",
                key,
                payload_hash,
                record.id,
                response.model_dump(mode="json"),
            )
            self.revisions.increment_history(revision)
        return response

    def get(self, owner_id: int, record_id: UUID) -> WearView:
        result = self.repo.read_owned(owner_id, record_id)
        if result is None:
            raise BusinessException(40431, "Wear record not found", 404)
        return self._view(*result)

    def patch(self, owner_id: int, record_id: UUID, payload: WearPatch) -> WearView:
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            record = self.repo.get_owned(owner_id, record_id)
            if record is None:
                raise BusinessException(40431, "Wear record not found", 404)
            existing = {item.garment_id: item for item in self.repo.items([record_id])}
            selected_ids = (
                payload.garment_ids
                if "garment_ids" in payload.model_fields_set
                else sorted(existing)
            )
            resources = [(record_id, "record")] + [
                (garment_id, "garment") for garment_id in selected_ids
            ]
            selected = {}
            for resource_id, kind in sorted(resources):
                if kind == "record":
                    record = self.repo.get_owned(owner_id, record_id, lock=True)
                else:
                    garment = self.garments.get_owned(owner_id, resource_id, lock=True)
                    if garment is None:
                        raise BusinessException(40430, "Garment not found", 404)
                    selected[resource_id] = garment
            if record.version != payload.expected_version:
                raise BusinessException(40932, "Wear record version conflict", 409)
            if "wear_date" in payload.model_fields_set:
                self._validate_date(payload.wear_date)
                record.wear_date = payload.wear_date
            for garment_id, item in existing.items():
                if garment_id not in selected:
                    self.repo.remove_item(item)
            for garment_id, garment in selected.items():
                if garment_id not in existing:
                    self.repo.add_item(
                        WearRecordItem(
                            record_id=record.id,
                            garment_id=garment_id,
                            name_snapshot=garment.name,
                            category_snapshot=garment.category,
                        )
                    )
            record.version += 1
            record.updated_at = self.clock()
            self.revisions.increment_history(revision)
            response = self._view(record, self.repo.items([record_id]))
        return response

    def delete(
        self, owner_id: int, record_id: UUID, expected_version: int
    ) -> WearDeleted:
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            tombstone = self.repo.tombstone(owner_id, record_id)
            if tombstone is not None:
                if tombstone.deleted_version != expected_version:
                    raise BusinessException(40932, "Wear record version conflict", 409)
                return WearDeleted(id=record_id)
            record = self.repo.get_owned(owner_id, record_id, lock=True)
            if record is None:
                raise BusinessException(40431, "Wear record not found", 404)
            if record.version != expected_version:
                raise BusinessException(40932, "Wear record version conflict", 409)
            self.repo.delete(record)
            self.revisions.increment_history(revision)
        return WearDeleted(id=record_id)

    def _validate_range(self, start_date: date | None, end_date: date | None) -> None:
        if start_date is not None and end_date is not None and start_date > end_date:
            raise BusinessException(42231, "Invalid date range", 422)

    def list(
        self,
        owner_id: int,
        start_date: date | None,
        end_date: date | None,
        cursor: str | None,
        page_size: int,
    ) -> WearList:
        self._validate_range(start_date, end_date)
        binding = {
            "scope": "wear-records",
            "owner": owner_id,
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
        }
        before = None
        if cursor is not None:
            try:
                encoded, signature = cursor.split(".")
                expected = hmac.new(
                    self.cursor_secret, encoded.encode(), hashlib.sha256
                ).hexdigest()
                if not hmac.compare_digest(signature, expected):
                    raise ValueError("Invalid signature")
                data = json.loads(
                    base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
                )
                if data["binding"] != binding:
                    raise ValueError("Cursor context changed")
                before = (date.fromisoformat(data["wear_date"]), UUID(data["id"]))
            except (ValueError, KeyError, TypeError, UnicodeDecodeError):
                raise BusinessException(
                    42232, "Invalid cursor for this history query", 422
                ) from None
        rows = self.repo.list_owned(
            owner_id, start_date, end_date, before, page_size + 1
        )
        items = [self._view(*row) for row in rows[:page_size]]
        next_cursor = None
        if len(rows) > page_size:
            last = items[-1]
            encoded = (
                base64.urlsafe_b64encode(
                    _canonical(
                        {
                            "binding": binding,
                            "wear_date": last.wear_date.isoformat(),
                            "id": str(last.id),
                        }
                    ).encode()
                )
                .decode()
                .rstrip("=")
            )
            next_cursor = (
                encoded
                + "."
                + hmac.new(
                    self.cursor_secret, encoded.encode(), hashlib.sha256
                ).hexdigest()
            )
        return WearList(items=items, next_cursor=next_cursor)

    def history_summary(
        self, owner_id: int, start_date: date, end_date: date
    ) -> HistorySummary:
        self._validate_range(start_date, end_date)
        record_count, rows = self.repo.history_summary(owner_id, start_date, end_date)
        return HistorySummary(
            start_date=start_date,
            end_date=end_date,
            record_count=record_count,
            garments=[
                GarmentHistorySummary(
                    garment_id=garment_id,
                    wear_count=wear_count,
                    last_wear_date=last_wear_date,
                )
                for garment_id, wear_count, last_wear_date in rows
            ],
        )
