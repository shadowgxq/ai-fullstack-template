"""Owned PG/Redis, actual services and HTTP. Only the internal AI boundary is doubled."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from threading import Barrier, Event
from uuid import uuid4

from fastapi import Depends
from fastapi.testclient import TestClient
import pytest
from redis import Redis
from sqlalchemy import event, func, inspect, select, text
from sqlalchemy.orm import Session

from app.api.dependencies import get_recommendation_service, get_wechat_code_exchange
from app.core import redis_client as redis_module
from app.core.exceptions import BusinessException
from app.core.session import get_db, transaction
from app.models.account_revision import AccountRevision
from app.models.idempotency_receipt import IdempotencyReceipt
from app.models.recommendation import RecommendationOutbox, RecommendationRequest
from app.models.wear_record import WearRecord, WearRecordItem
from app.repositories.weather_repository import WeatherRepository
from app.schemas.garment import GarmentCreate, GarmentPatch
from app.schemas.preferences import PreferencesPut
from app.schemas.recommendation import RecommendationCreate
from app.schemas.wear import WearCreate, WearPatch
from app.schemas.weather import WeatherContextView
from app.services import auth_redis_service, cache_service
from app.services.ai_runtime_client import AiRuntimeError
from app.services.recommendation_service import canonical
from app.services.wechat_service import WechatAccountIdentity
from main import app
from test_preferences import empty_payload, preferences_service
from test_weather import hangzhou
from test_weather_postgres import fresh_facts
import test_garment_postgres
import test_wechat_postgres
from test_wear_postgres import history

postgres_database = test_wechat_postgres.postgres_database
NOW = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)


class Crash(BaseException):
    pass


class AiBoundary:
    def __init__(self):
        self.runs, self.calls, self.hook = {}, [], None

    def _call(self, method, key, payload, db):
        assert not db.in_transaction(), (
            "AI HTTP must not hold any business/autobegin transaction"
        )
        self.calls.append((method, key, deepcopy(payload)))
        if self.hook:
            self.hook(method, key, payload)

    def client(self, db):
        outer = self

        class Client:
            def create_run(self, key, payload):
                outer._call("create", key, payload, db)
                if key not in outer.runs:
                    outer.runs[key] = {
                        "run_id": str(uuid4()),
                        "workflow": "wardrobe.recommend.v1",
                        "input": deepcopy(payload),
                        "status": "queued",
                        "output": None,
                        "error_code": None,
                    }
                return deepcopy(outer.runs[key])

            def get_run(self, run_id, payload):
                outer._call("get", run_id, payload, db)
                return deepcopy(
                    next(run for run in outer.runs.values() if run["run_id"] == run_id)
                )

            def cancel_run(self, run_id, payload):
                outer._call("cancel", run_id, payload, db)
                run = next(
                    run for run in outer.runs.values() if run["run_id"] == run_id
                )
                if run["status"] in {"queued", "running"}:
                    run["status"] = "cancelled"
                return deepcopy(run)

            def cancel_by_key(self, key, payload):
                outer._call("cancel_by_key", key, payload, db)
                if key not in outer.runs:
                    outer.runs[key] = {
                        "run_id": str(uuid4()),
                        "workflow": "wardrobe.recommend.v1",
                        "input": deepcopy(payload),
                        "status": "cancelled",
                        "output": None,
                        "error_code": None,
                    }
                run = outer.runs[key]
                if run["status"] in {"queued", "running"}:
                    run["status"] = "cancelled"
                return deepcopy(run)

        return Client()

    def complete(self, request_id, **updates):
        run = self.runs[f"wardrobe:{request_id}"]
        run["status"] = "completed"
        run["output"] = {
            "selected_ids": [run["input"]["candidates"][0]["id"]],
            "reason_codes": [],
            "fact_refs": [],
            "tradeoff_codes": [],
            "call_evidence": {},
            **updates,
        }


@pytest.fixture
def stack(postgres_database):
    engine, migrate = postgres_database
    migrate("head")
    owner = test_garment_postgres.create_owner(engine)
    return engine, owner, AiBoundary()


def service(db, ai, now=NOW):
    instance = get_recommendation_service(db)
    instance.ai, instance.clock, instance.weather.clock = (
        ai.client(db),
        lambda: now,
        lambda: now,
    )
    return instance


def add(engine, owner, count=1, **fields):
    with Session(engine) as db:
        return [
            test_garment_postgres.garments(db)
            .create(owner, GarmentCreate(name=f"衣物{index}", **fields), str(uuid4()))
            .id
            for index in range(count)
        ]


def create(stack, key="request", **fields):
    engine, owner, ai = stack
    with Session(engine) as db:
        return service(db, ai).create(owner, RecommendationCreate(**fields), key)


def dispatch(stack, now=NOW):
    engine, _, ai = stack
    with Session(engine) as db:
        return service(db, ai, now).dispatch_once()


def get(stack, request_id, now=NOW):
    engine, owner, ai = stack
    with Session(engine) as db:
        return service(db, ai, now).get(owner, request_id)


def ready(stack):
    view = create(stack)
    assert dispatch(stack)
    stack[2].complete(view.request_id)
    return get(stack, view.request_id)


def test_full_inventory_filter_then_sort_and_16_capacity_and_recent_history(stack):
    engine, owner, ai = stack
    ids = add(engine, owner, 22, color="black", tags=["casual"])
    with Session(engine) as db:
        prefs = {
            **empty_payload(),
            "liked_colors": ["black"],
            "comfort_notes": "仅参考：不要未知鞋跟",
        }
        preferences_service(db).put(owner, PreferencesPut(**prefs))
        history(db).create(
            owner, WearCreate(wear_date=date(2020, 1, 1), garment_ids=[ids[0]]), "old"
        )
        history(db).create(
            owner, WearCreate(wear_date=NOW.date(), garment_ids=[ids[1]]), "recent"
        )
    view = create(stack)
    assert (
        view.inventory_count == view.eligible_count == 22
        and view.candidate_scope_limited
    )
    assert dispatch(stack)
    frozen = ai.calls[0][2]
    assert len(frozen["candidates"]) == 16
    assert (
        frozen["history"]["start_date"] == "2026-09-23"
        and frozen["history"]["end_date"] == "2026-10-22"
    )
    assert all(item["wear_count"] == 0 for item in frozen["history"]["garments"])
    assert str(ids[1]) not in [item["id"] for item in frozen["candidates"]]
    assert frozen["preferences"]["comfort_notes"] == prefs["comfort_notes"]
    assert not any(
        "photo" in key or key == "notes"
        for item in frozen["candidates"]
        for key in item
    )
    assert len(frozen["fact_refs"]) <= 256


@pytest.mark.parametrize(
    "state,outcome",
    [
        ("empty", "no_inventory"),
        ("archived", "no_candidates"),
        ("unknown_style", "no_candidates"),
    ],
)
def test_normal_empty_outcomes_never_create_outbox_or_call_model(stack, state, outcome):
    engine, owner, ai = stack
    if state != "empty":
        gid = add(engine, owner)[0]
        with Session(engine) as db:
            if state == "archived":
                test_garment_postgres.garments(db).patch(
                    owner, gid, GarmentPatch(expected_version=1, status="archived")
                )
            else:
                preferences_service(db).put(
                    owner,
                    PreferencesPut(
                        **{**empty_payload(), "avoided_styles": ["sporty"]},
                    ),
                )
    view = create(stack)
    assert view.status == "ready" and view.outcome == outcome and view.result is None
    assert not dispatch(stack) and ai.calls == []
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(RecommendationOutbox)) == 0


def test_later_inventory_candidate_survives_hard_filter_and_stable_replay(stack):
    engine, owner, _ = stack
    ids = add(engine, owner, 35, color="red")
    good = add(engine, owner, color="black")[0]
    with Session(engine) as db:
        preferences_service(db).put(
            owner,
            PreferencesPut(**{**empty_payload(), "avoided_colors": ["red"]}),
        )
    created = create(stack)
    assert created.inventory_count == 36 and created.eligible_count == 1
    assert dispatch(stack)
    assert [item["id"] for item in stack[2].calls[0][2]["candidates"]] == [str(good)]
    with Session(engine) as db:
        test_garment_postgres.garments(db).patch(
            owner, ids[0], GarmentPatch(expected_version=1, name="修改")
        )
    replay = create(stack)
    assert replay.request_id == created.request_id
    with pytest.raises(BusinessException) as error:
        create(stack, scene="work")
    assert error.value.code == 40980


@pytest.mark.parametrize(
    "reason",
    [
        "liked_color",
        "liked_style",
        "liked_occasion",
        "weather_reference",
        "history_reference",
        "scene_reference",
        "known_attributes",
    ],
)
def test_unsubstantiated_model_reasons_fail_without_second_call(stack, reason):
    add(stack[0], stack[1])
    view = create(stack)
    dispatch(stack)
    stack[2].complete(view.request_id, reason_codes=[reason])
    result = get(stack, view.request_id)
    assert result.status == "failed" and result.error_code == "invalid_output"
    assert len([call for call in stack[2].calls if call[0] == "create"]) == 1


@pytest.mark.parametrize(
    "mutation", ["foreign_id", "fake_fact", "comfort_matched", "duplicate", "free_text"]
)
def test_invalid_model_members_cannot_publish(stack, mutation):
    add(stack[0], stack[1])
    view = create(stack)
    dispatch(stack)
    stack[2].complete(view.request_id)
    output = stack[2].runs[f"wardrobe:{view.request_id}"]["output"]
    if mutation == "foreign_id":
        output["selected_ids"] = [str(uuid4())]
    elif mutation == "fake_fact":
        output["fact_refs"] = ["invented"]
    elif mutation == "comfort_matched":
        output["reason_codes"] = ["comfort_matched"]
    elif mutation == "duplicate":
        output["selected_ids"] *= 2
    else:
        output["free_reason"] = "保证满足"
    assert get(stack, view.request_id).error_code == "invalid_output"


def test_mapping_lost_after_remote_create_lease_recovery_reuses_same_run(
    stack, monkeypatch
):
    engine, owner, ai = stack
    add(engine, owner)
    view = create(stack)
    with Session(engine) as db:
        instance = service(db, ai)
        original = instance.repo.lock_command
        count = 0

        def crash_after_http(command_id):
            nonlocal count
            count += 1
            if count == 2:
                raise Crash()
            return original(command_id)

        monkeypatch.setattr(instance.repo, "lock_command", crash_after_http)
        with pytest.raises(Crash):
            instance.dispatch_once()
    first_id = ai.runs[f"wardrobe:{view.request_id}"]["run_id"]
    with Session(engine) as db:
        assert db.get(RecommendationRequest, view.request_id).ai_run_id is None
    assert dispatch(stack, NOW + timedelta(seconds=31))
    with Session(engine) as db:
        assert str(db.get(RecommendationRequest, view.request_id).ai_run_id) == first_id
    assert (
        len(ai.runs) == 1
        and len([call for call in ai.calls if call[0] == "create"]) == 2
    )


def test_cancel_before_any_dispatch_creates_only_cancel_tombstone_and_never_revives(
    stack,
):
    engine, owner, ai = stack
    add(engine, owner)
    view = create(stack)
    with Session(engine) as db:
        assert service(db, ai).cancel(owner, view.request_id).status == "cancelled"
    assert dispatch(stack)
    assert dispatch(stack)
    assert [call[0] for call in ai.calls] == ["cancel_by_key", "cancel"] or [
        call[0] for call in ai.calls
    ] == ["cancel_by_key", "cancel_by_key"]
    assert all(run["status"] == "cancelled" for run in ai.runs.values())
    ai.complete(view.request_id)
    assert get(stack, view.request_id).status == "cancelled"


def test_cancel_during_create_and_late_reply_keep_business_terminal(stack):
    engine, owner, ai = stack
    add(engine, owner)
    view = create(stack)
    entered, release = Event(), Event()

    def pause(method, key, payload):
        if method == "create":
            entered.set()
            assert release.wait(10)

    ai.hook = pause
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(dispatch, stack)
        assert entered.wait(10)
        with Session(engine) as db:
            assert service(db, ai).cancel(owner, view.request_id).status == "cancelled"
        release.set()
        assert future.result(10)
    ai.hook = None
    assert dispatch(stack)
    assert ai.runs[f"wardrobe:{view.request_id}"]["status"] == "cancelled"
    assert get(stack, view.request_id).status == "cancelled"


def test_ready_wins_cancel_and_replacements_rebuild_complete_order_without_wear(stack):
    engine, owner, ai = stack
    ids = add(engine, owner, 19, color="black")
    view = ready(stack)
    assert view.result and view.status == "ready"
    with Session(engine) as db:
        instance = service(db, ai)
        assert instance.cancel(owner, view.request_id).status == "ready"
        first = instance.candidates(owner, view.request_id, [ids[0]], None, 5)
        assert len(first.items) == 5 and first.next_cursor
        second = instance.candidates(
            owner, view.request_id, [ids[0]], first.next_cursor, 5
        )
        assert not set(item.id for item in first.items) & {
            item.id for item in second.items
        }
        with pytest.raises(BusinessException) as error:
            instance.candidates(owner, view.request_id, [], first.next_cursor, 5)
        assert error.value.code == 42281
        frozen_ids = {
            item["id"]
            for item in ai.runs[f"wardrobe:{view.request_id}"]["input"]["candidates"]
        }
        outside = next(gid for gid in ids if str(gid) not in frozen_ids)
        other = next(gid for gid in ids if gid != outside)
        selection = instance.validate_selection(
            owner, view.request_id, [outside, other]
        )
        assert selection.selected_ids == [outside, other]
        assert db.scalar(select(func.count()).select_from(WearRecord)) == 0
    assert len([call for call in ai.calls if call[0] == "create"]) == 1


@pytest.mark.parametrize("change", ["inventory", "preferences", "history"])
def test_each_revision_invalidates_publish_and_later_ready_read(stack, change):
    engine, owner, ai = stack
    gid = add(engine, owner)[0]
    view = ready(stack)
    with Session(engine) as db:
        if change == "inventory":
            test_garment_postgres.garments(db).patch(
                owner, gid, GarmentPatch(expected_version=1, name="新名")
            )
        elif change == "preferences":
            preferences_service(db).put(owner, PreferencesPut(**empty_payload()))
        else:
            history(db).create(
                owner, WearCreate(wear_date=NOW.date(), garment_ids=[gid]), "manual"
            )
    result = get(stack, view.request_id)
    assert (
        result.status == "stale"
        and result.error_code == "input_changed"
        and result.result is None
    )


def test_deadline_and_expired_lease_cannot_publish_late_success(stack):
    engine, owner, ai = stack
    add(engine, owner)
    view = create(stack)
    with Session(engine) as db:
        instance = service(db, ai)

        def expire(method, key, payload):
            instance.clock = lambda: NOW + timedelta(seconds=31)

        ai.hook = expire
        assert instance.dispatch_once()
    ai.hook = None
    with Session(engine) as db:
        assert db.get(RecommendationRequest, view.request_id).ai_run_id is None
    assert dispatch(stack, NOW + timedelta(minutes=6))
    ai.complete(view.request_id)
    result = get(stack, view.request_id, NOW + timedelta(minutes=6))
    assert result.status == "failed" and result.error_code == "deadline_exceeded"
    assert len([call for call in ai.calls if call[0] == "create"]) == 1


def test_retryable_failure_preserves_intent_backoff_and_business_deadline(stack):
    engine, owner, ai = stack
    add(engine, owner)
    view = create(stack)

    def unavailable(*args):
        raise AiRuntimeError("ai_unavailable", retryable=True)

    ai.hook = unavailable
    assert dispatch(stack)
    assert not dispatch(stack)
    assert get(stack, view.request_id, NOW + timedelta(minutes=6)).status == "failed"
    ai.hook = None
    assert dispatch(stack, NOW + timedelta(minutes=6))
    assert not any(call[0] == "create" for call in ai.calls[1:])


def test_partial_weather_preserved_owner_and_expiry_missing_cross_day_valid(stack):
    engine, owner, ai = stack
    add(engine, owner)
    region = hangzhou()
    context = WeatherContextView(
        context_id=uuid4(),
        region=region,
        selection_source="selected",
        weather_date=NOW.date(),
        valid_until=fresh_facts(region, NOW).valid_until,
        state="available",
        facts=fresh_facts(region, NOW),
        missing_reason=None,
    )
    with Session(engine) as db, transaction(db):
        WeatherRepository(db).create(owner, context)
    view = create(stack, weather_context_id=context.context_id)
    dispatch(stack)
    frozen = ai.calls[0][2]["weather"]
    assert frozen["facts"] == context.facts.model_dump(mode="json")
    assert (
        frozen["facts"]["observation"] is None
        and frozen["facts"]["forecast"]["high_c"] is None
    )
    ai.complete(view.request_id)
    assert get(stack, view.request_id).status == "ready"
    assert (
        get(stack, view.request_id, NOW + timedelta(days=1)).error_code
        == "weather_expired"
    )
    with pytest.raises(BusinessException) as error:
        create(
            stack,
            key="expired",
            weather_context_id=uuid4(),
        )
    assert error.value.status_code == 404
    missing = create(stack, key="without-weather")
    dispatch(stack)
    ai.complete(missing.request_id)
    assert get(stack, missing.request_id).status == "ready"
    assert get(stack, missing.request_id, NOW + timedelta(days=1)).status == "ready"


def test_sourced_wear_receipt_first_replay_stale_rejection_manual_history_unchanged(
    stack,
):
    engine, owner, ai = stack
    ids = add(engine, owner, 2)
    view = ready(stack)
    with Session(engine) as db:
        instance = history(db)
        instance.recommendations = service(db, ai)
        payload = WearCreate(
            wear_date=NOW.date(),
            garment_ids=ids,
            recommendation_request_id=view.request_id,
        )
        saved = instance.create(owner, payload, "sourced")
        assert instance.create(owner, payload, "sourced") == saved
        assert (
            instance.get(owner, saved.id).recommendation_request_id == view.request_id
        )
        with pytest.raises(BusinessException) as error:
            instance.create(owner, payload, "new-key")
        assert error.value.code == 40982
        patched = instance.patch(
            owner, saved.id, WearPatch(expected_version=1, wear_date=date(2020, 1, 1))
        )
        assert (
            patched.recommendation_request_id == view.request_id
            and patched.items[0].name_snapshot == "衣物0"
        )
        instance.delete(owner, saved.id, patched.version)
        with pytest.raises(BusinessException) as error:
            instance.create(owner, payload, "sourced")
        assert error.value.code == 40931


def test_same_key_concurrent_create_and_failed_commit_roll_back_intent(stack):
    engine, owner, ai = stack
    add(engine, owner)
    barrier = Barrier(2)

    def concurrent(_):
        with Session(engine) as db:
            barrier.wait(10)
            return (
                service(db, ai).create(owner, RecommendationCreate(), "same").request_id
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(concurrent, range(2)))
    assert results[0] == results[1]
    with Session(engine) as db:

        def fail(session):
            raise RuntimeError("commit boundary")

        event.listen(db, "before_commit", fail)
        with pytest.raises(RuntimeError):
            service(db, ai).create(owner, RecommendationCreate(), "rollback")
        event.remove(db, "before_commit", fail)
        assert db.scalar(select(func.count()).select_from(RecommendationRequest)) == 1
        assert db.scalar(select(func.count()).select_from(RecommendationOutbox)) == 1


def test_migration_preserves_legacy_wear_receipt_and_metadata(postgres_database):
    engine, migrate = postgres_database
    migrate("8edcf8789aeb")
    gid, record = uuid4(), uuid4()
    old_content = {"wear_date": "2020-01-01", "garment_ids": [str(gid)]}
    old_hash = hashlib.sha256(canonical(old_content).encode()).hexdigest()
    with engine.begin() as conn:
        owner = conn.scalar(
            text("INSERT INTO users(username) VALUES ('legacy-rec') RETURNING id")
        )
        conn.execute(
            text(
                "INSERT INTO account_revisions(owner_id,inventory_revision,history_revision,preferences_revision) VALUES (:o,7,8,9)"
            ),
            {"o": owner},
        )
        conn.execute(
            text(
                "INSERT INTO garments(id,owner_id,name,season,occasion,tags,status,version,created_at,updated_at) VALUES (:id,:o,'旧衣物','[]','[]','[]','archived',3,now(),now())"
            ),
            {"id": gid, "o": owner},
        )
        conn.execute(
            text(
                "INSERT INTO wear_records(id,owner_id,wear_date,version,created_at,updated_at) VALUES (:id,:o,'2020-01-01',1,now(),now())"
            ),
            {"id": record, "o": owner},
        )
        conn.execute(
            text(
                "INSERT INTO wear_record_items(record_id,garment_id,name_snapshot,category_snapshot) VALUES (:r,:g,'旧快照','tops')"
            ),
            {"r": record, "g": gid},
        )
        conn.execute(
            text(
                "INSERT INTO idempotency_receipts(owner_id,operation,key,payload_hash,resource_id,response_json) VALUES (:o,'wear-record.create','legacy-key',:h,:r,:response)"
            ),
            {
                "o": owner,
                "h": old_hash,
                "r": record,
                "response": json.dumps({"id": str(record), "version": 1}),
            },
        )
    migrate("head")
    with Session(engine) as db:
        assert db.get(WearRecord, record).recommendation_request_id is None
        assert (
            history(db).create(owner, WearCreate(**old_content), "legacy-key").id
            == record
        )
        assert db.get(WearRecordItem, (record, gid)).name_snapshot == "旧快照"
        revision = db.get(AccountRevision, owner)
        assert (
            revision.inventory_revision,
            revision.history_revision,
            revision.preferences_revision,
        ) == (7, 8, 9)
    env = dict(
        os.environ, DATABASE_URL=engine.url.render_as_string(hide_password=False)
    )
    check = subprocess.run(
        [sys.executable, "-m", "alembic", "check"],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    assert "No new upgrade operations detected" in check.stdout
    assert "recommendation_request_id" in {
        col["name"] for col in inspect(engine).get_columns("wear_records")
    }


def test_cancel_during_completed_get_wins_before_publish(stack):
    engine, owner, ai = stack
    add(engine, owner)
    view = create(stack)
    dispatch(stack)
    ai.complete(view.request_id)
    entered, release = Event(), Event()

    def pause(method, *args):
        if method == "get":
            entered.set()
            assert release.wait(10)

    ai.hook = pause
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(get, stack, view.request_id)
        assert entered.wait(10)
        with Session(engine) as db:
            assert service(db, ai).cancel(owner, view.request_id).status == "cancelled"
        release.set()
        assert future.result(10).status == "cancelled"
    assert get(stack, view.request_id).result is None


def test_new_lease_owner_prevents_old_dispatcher_overwrite(stack):
    engine, owner, ai = stack
    add(engine, owner)
    view = create(stack)
    entered, release = Event(), Event()
    first = True

    def pause(method, *args):
        nonlocal first
        if method == "create" and first:
            first = False
            entered.set()
            assert release.wait(10)

    ai.hook = pause
    with ThreadPoolExecutor(max_workers=1) as pool:
        old = pool.submit(dispatch, stack)
        assert entered.wait(10)
        assert dispatch(stack, NOW + timedelta(seconds=31))
        with Session(engine) as db:
            mapped = db.get(RecommendationRequest, view.request_id).ai_run_id
        release.set()
        assert old.result(10)
    with Session(engine) as db:
        assert db.get(RecommendationRequest, view.request_id).ai_run_id == mapped
        command = db.scalar(
            select(RecommendationOutbox).where(
                RecommendationOutbox.request_id == view.request_id
            )
        )
        assert command.state == "done" and command.attempts == 2
    assert len(ai.runs) == 1


def test_source_save_commit_failure_rolls_back_history_and_receipt(stack):
    engine, owner, ai = stack
    gid = add(engine, owner)[0]
    view = ready(stack)
    with Session(engine) as db:
        instance = history(db)
        instance.recommendations = service(db, ai)

        def fail(session):
            raise RuntimeError("source save commit boundary")

        event.listen(db, "before_commit", fail)
        with pytest.raises(RuntimeError):
            instance.create(
                owner,
                WearCreate(
                    wear_date=NOW.date(),
                    garment_ids=[gid],
                    recommendation_request_id=view.request_id,
                ),
                "failed-save",
            )
        event.remove(db, "before_commit", fail)
        assert db.scalar(select(func.count()).select_from(WearRecord)) == 0
        assert (
            db.scalar(
                select(func.count())
                .select_from(IdempotencyReceipt)
                .where(IdempotencyReceipt.operation == "wear-record.create")
            )
            == 0
        )
        assert db.get(AccountRevision, owner).history_revision == 0
        assert db.get(RecommendationRequest, view.request_id).status == "ready"


def test_actual_authenticated_http_recommendation_selection_source_and_logout(
    postgres_database, monkeypatch
):
    redis_url = os.getenv("WARDROBE_TEST_REDIS_URL")
    if redis_url is None:
        pytest.skip("Explicit owned Redis db14 is required")
    assert redis_url == "redis://127.0.0.1:56379/14"
    engine, migrate = postgres_database
    migrate("head")
    redis = Redis.from_url(
        redis_url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2
    )
    assert redis.ping()
    prefix = "recommendation-http-" + uuid4().hex + ":"
    monkeypatch.setattr(auth_redis_service, "TOKEN_BLACKLIST_PREFIX", prefix + "jwt:")
    monkeypatch.setattr(cache_service, "USER_CACHE_PREFIX", prefix + "user:")
    for module in (redis_module, auth_redis_service, cache_service):
        monkeypatch.setattr(module, "redis_client", redis)
    ai = AiBoundary()
    active = []

    def sessions():
        with Session(engine) as db:
            active.append(db)
            try:
                yield db
            finally:
                active.remove(db)

    def recommendation_dependency(db=Depends(get_db)):
        return service(db, ai)

    class Exchange:
        def exchange(self, code):
            return WechatAccountIdentity("wx-recommendation-boundary", code)

    def inspect_http(*args):
        assert not any(db.in_transaction() for db in active)

    ai.hook = inspect_http
    overrides = {
        get_db: sessions,
        get_wechat_code_exchange: Exchange,
        get_recommendation_service: recommendation_dependency,
    }
    app.dependency_overrides.update(overrides)
    captured = {}

    def data(response, status=200):
        assert response.status_code == status, response.text
        assert response.json()["code"] == 0
        return response.json()["data"]

    try:
        with TestClient(app) as client:
            accounts = [
                data(client.post("/api/v1/auth/wechat", json={"code": code}))
                for code in ("owner", "other")
            ]
            own, other = [
                {"Authorization": "Bearer " + account["access_token"]}
                for account in accounts
            ]
            assert client.post("/api/v1/recommendations", json={}).status_code == 401
            captured["empty"] = data(
                client.post(
                    "/api/v1/recommendations",
                    headers={**own, "Idempotency-Key": "empty"},
                    json={},
                ),
                202,
            )
            gids = [
                data(
                    client.post(
                        "/api/v1/garments",
                        headers={**own, "Idempotency-Key": f"garment-{index}"},
                        json={
                            "name": f"单品{index}",
                            "color": "black",
                            "tags": ["casual"],
                        },
                    )
                )["id"]
                for index in range(2)
            ]
            prefs = {
                **empty_payload(),
                "liked_colors": ["black"],
                "comfort_notes": "怕冷或偏好宽松，仅参考",
            }
            data(client.put("/api/v1/preferences", headers=own, json=prefs))
            captured["queued"] = data(
                client.post(
                    "/api/v1/recommendations",
                    headers={**own, "Idempotency-Key": "actual"},
                    json={"scene": "daily"},
                ),
                202,
            )
            rid = captured["queued"]["request_id"]
            assert (
                data(
                    client.post(
                        "/api/v1/recommendations",
                        headers={**own, "Idempotency-Key": "actual"},
                        json={"scene": "daily"},
                    ),
                    202,
                )["request_id"]
                == rid
            )
            with Session(engine) as db:
                assert service(db, ai).dispatch_once()
            captured["generating"] = data(
                client.get(f"/api/v1/recommendations/{rid}", headers=own)
            )
            ai.complete(rid)
            captured["ready"] = data(
                client.get(f"/api/v1/recommendations/{rid}", headers=own)
            )
            assert (
                captured["ready"]["status"] == "ready"
                and captured["ready"]["result"]["selected_ids"]
            )
            assert any(
                "不保证" in item for item in captured["ready"]["result"]["limitations"]
            )
            captured["candidates"] = data(
                client.get(
                    f"/api/v1/recommendations/{rid}/replacement-candidates",
                    headers=own,
                    params={"exclude_ids": gids[0], "page_size": 1},
                )
            )
            captured["selection"] = data(
                client.post(
                    f"/api/v1/recommendations/{rid}/validate-selection",
                    headers=own,
                    json={"selected_ids": [gids[1], gids[0]]},
                )
            )
            assert captured["selection"]["selected_ids"] == [gids[1], gids[0]]
            for suffix in ("", "/replacement-candidates"):
                assert (
                    client.get(
                        f"/api/v1/recommendations/{rid}{suffix}", headers=other
                    ).status_code
                    == 404
                )
            assert (
                client.post(
                    f"/api/v1/recommendations/{rid}/cancel", headers=other
                ).status_code
                == 404
            )
            assert (
                client.post(
                    f"/api/v1/recommendations/{rid}/validate-selection",
                    headers=other,
                    json={"selected_ids": gids},
                ).status_code
                == 404
            )
            assert (
                client.post(
                    "/api/v1/recommendations",
                    headers={**own, "Idempotency-Key": "extra"},
                    json={"owner_id": 1},
                ).status_code
                == 422
            )
            assert (
                client.post(
                    f"/api/v1/recommendations/{rid}/validate-selection",
                    headers=own,
                    json={"selected_ids": [gids[0], gids[0]]},
                ).status_code
                == 422
            )
            source = {
                "wear_date": "2020-10-22",
                "garment_ids": gids,
                "recommendation_request_id": rid,
            }
            captured["wear_created"] = data(
                client.post(
                    "/api/v1/wear-records",
                    headers={**own, "Idempotency-Key": "actual-wear"},
                    json=source,
                )
            )
            assert (
                data(
                    client.post(
                        "/api/v1/wear-records",
                        headers={**own, "Idempotency-Key": "actual-wear"},
                        json=source,
                    )
                )
                == captured["wear_created"]
            )
            captured["wear_detail"] = data(
                client.get(
                    f"/api/v1/wear-records/{captured['wear_created']['id']}",
                    headers=own,
                )
            )
            assert captured["wear_detail"]["recommendation_request_id"] == rid
            captured["stale"] = data(
                client.get(f"/api/v1/recommendations/{rid}", headers=own)
            )
            assert captured["stale"]["status"] == "stale"
            assert (
                client.post(
                    "/api/v1/wear-records",
                    headers={**own, "Idempotency-Key": "stale-wear"},
                    json=source,
                ).status_code
                == 409
            )
            captured["statistics"] = data(client.get("/api/v1/statistics", headers=own))
            assert captured["statistics"]["wear_record_count"] == 1
            cancelled_id = data(
                client.post(
                    "/api/v1/recommendations",
                    headers={**own, "Idempotency-Key": "cancel-new"},
                    json={},
                ),
                202,
            )["request_id"]
            captured["cancelled"] = data(
                client.post(
                    f"/api/v1/recommendations/{cancelled_id}/cancel", headers=own
                )
            )
            assert captured["cancelled"]["status"] == "cancelled"
            data(client.post("/api/v1/auth/logout", headers=own))
            assert (
                client.get(f"/api/v1/recommendations/{rid}", headers=own).status_code
                == 401
            )
            assert (
                client.get(f"/api/v1/recommendations/{rid}", headers=other).status_code
                == 404
            )
        output = os.getenv("WARDROBE_RECOMMENDATION_CONSUMER_RESPONSES")
        if output:
            expected = (
                Path(__file__).resolve().parents[2]
                / ".tools/manager-runtime/recommendation-consumer-responses.json"
            )
            assert Path(output).resolve() == expected.resolve()
            expected.write_text(
                json.dumps(captured, ensure_ascii=False, indent=2) + "\n"
            )
    finally:
        for key in overrides:
            app.dependency_overrides.pop(key, None)
        keys = list(redis.scan_iter(match=prefix + "*"))
        if keys:
            redis.delete(*keys)
        redis.close()
