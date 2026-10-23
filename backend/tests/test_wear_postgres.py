"""仅本次明确测试 DSN 的 UUID schema；PostgreSQL 真实迁移与账户锁竞争。"""

from concurrent.futures import ThreadPoolExecutor
from datetime import date
import os
from pathlib import Path
import subprocess
import sys
from threading import Barrier, Event

import pytest
from sqlalchemy import func, inspect, select, text
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessException
from app.api.dependencies import get_recommendation_service
from app.models.account_revision import AccountRevision
from app.models.wear_record import WearRecord, WearRecordItem, WearRecordTombstone
from app.repositories.garment_repository import GarmentRepository
from app.repositories.idempotency_repository import IdempotencyRepository
from app.repositories.revision_repository import RevisionRepository
from app.repositories.wear_repository import WearRepository
from app.schemas.garment import GarmentCreate, GarmentPatch
from app.schemas.wear import WearCreate, WearPatch
from app.services.wear_service import WearService
import test_garment_postgres
import test_wechat_postgres

postgres_database = test_wechat_postgres.postgres_database
DAY = date(2020, 10, 22)


def history(db, revisions=None, receipts=None):
    return WearService(
        WearRepository(db),
        GarmentRepository(db),
        revisions or RevisionRepository(db),
        receipts or IdempotencyRepository(db),
        "history-test-only",
        recommendations=get_recommendation_service(db),
    )


def setup_inventory(postgres_database):
    engine, migrate = postgres_database
    migrate("head")
    owner_id = test_garment_postgres.create_owner(engine)
    with Session(engine) as db:
        garment_id = (
            test_garment_postgres.garments(db)
            .create(owner_id, GarmentCreate(name="旧名称", category="tops"), "initial")
            .id
        )
    return engine, owner_id, garment_id


def test_old_head_preserves_inventory_backfills_history_and_matches_metadata(
    postgres_database,
):
    engine, migrate = postgres_database
    migrate("85b26bb544ee")
    with engine.begin() as connection:
        owner_id = connection.scalar(
            text(
                "INSERT INTO users(username,password_hash) VALUES ('old-account',NULL) RETURNING id"
            )
        )
        connection.execute(
            text(
                "INSERT INTO account_revisions(owner_id,inventory_revision) VALUES (:owner,7)"
            ),
            {"owner": owner_id},
        )
    migrate("head")
    with Session(engine) as db:
        revision = db.get(AccountRevision, owner_id)
        assert (revision.inventory_revision, revision.history_revision) == (7, 0)
    constraints = {
        value["name"]
        for value in inspect(engine).get_check_constraints("account_revisions")
    }
    assert "ck_history_revision_nonnegative" in constraints
    env = dict(
        os.environ, DATABASE_URL=engine.url.render_as_string(hide_password=False)
    )
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "check"],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert "No new upgrade operations detected" in result.stdout


def test_concurrent_same_creation_receipt_and_same_version_edit(postgres_database):
    engine, owner_id, garment_id = setup_inventory(postgres_database)
    barrier = Barrier(2)
    payload = WearCreate(wear_date=DAY, garment_ids=[garment_id, garment_id])

    def create(_):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            return history(db).create(owner_id, payload, "same")

    with ThreadPoolExecutor(max_workers=2) as pool:
        receipts = list(pool.map(create, range(2)))
    assert receipts[0] == receipts[1]
    record_id = receipts[0].id
    barrier.reset()

    def patch(index):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            try:
                return (
                    history(db)
                    .patch(
                        owner_id,
                        record_id,
                        WearPatch(
                            expected_version=1, wear_date=date(2020, 10, 20 + index)
                        ),
                    )
                    .version
                )
            except BusinessException as error:
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(patch, range(2)))
    assert sorted(results) == [2, 409]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(WearRecord)) == 1
        assert db.scalar(select(func.count()).select_from(WearRecordItem)) == 1
        assert (
            db.get(AccountRevision, owner_id).inventory_revision,
            db.get(AccountRevision, owner_id).history_revision,
        ) == (1, 2)
        assert history(db).create(owner_id, payload, "same") == receipts[0]
        summary = history(db).history_summary(owner_id, date(2020, 10, 1), DAY)
        assert summary.record_count == 1 and summary.garments[0].wear_count == 1


def pausing_revisions(first_locked, release):
    class Pausing(RevisionRepository):
        def lock(self, owner_id):
            row = super().lock(owner_id)
            first_locked.set()
            assert release.wait(timeout=10)
            return row

    return Pausing


@pytest.mark.parametrize("winner", ["patch", "delete"])
def test_edit_delete_race_respects_version_or_deleted_record(postgres_database, winner):
    engine, owner_id, garment_id = setup_inventory(postgres_database)
    with Session(engine) as db:
        record_id = (
            history(db)
            .create(
                owner_id, WearCreate(wear_date=DAY, garment_ids=[garment_id]), "create"
            )
            .id
        )
    first_locked, release = Event(), Event()
    Pausing = pausing_revisions(first_locked, release)

    def act(operation, pause):
        with Session(engine) as db:
            service = history(db, Pausing(db) if pause else None)
            try:
                if operation == "patch":
                    service.patch(
                        owner_id,
                        record_id,
                        WearPatch(expected_version=1, wear_date=date(2020, 10, 21)),
                    )
                else:
                    service.delete(owner_id, record_id, 1)
                return 200
            except BusinessException as error:
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(act, winner, True)
        try:
            assert first_locked.wait(timeout=10)
            second = pool.submit(act, "delete" if winner == "patch" else "patch", False)
            release.set()
            assert first.result(timeout=15) == 200
            assert second.result(timeout=15) == (409 if winner == "patch" else 404)
        finally:
            release.set()
    with Session(engine) as db:
        assert db.get(AccountRevision, owner_id).history_revision == 2
        detail = test_garment_postgres.garments(db).get(owner_id, garment_id)
        assert detail.wear_count == (1 if winner == "patch" else 0)


@pytest.mark.parametrize("winner", ["replay", "delete"])
def test_old_post_and_delete_race_never_resurrects(postgres_database, winner):
    engine, owner_id, garment_id = setup_inventory(postgres_database)
    payload = WearCreate(wear_date=DAY, garment_ids=[garment_id])
    with Session(engine) as db:
        record_id = history(db).create(owner_id, payload, "create").id
    first_locked, release = Event(), Event()
    Pausing = pausing_revisions(first_locked, release)

    def act(operation, pause):
        with Session(engine) as db:
            service = history(db, Pausing(db) if pause else None)
            try:
                if operation == "replay":
                    service.create(owner_id, payload, "create")
                else:
                    service.delete(owner_id, record_id, 1)
                return 200
            except BusinessException as error:
                return error.status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(act, winner, True)
        try:
            assert first_locked.wait(timeout=10)
            second = pool.submit(
                act, "delete" if winner == "replay" else "replay", False
            )
            release.set()
            assert first.result(timeout=15) == 200
            assert second.result(timeout=15) == (200 if winner == "replay" else 409)
        finally:
            release.set()
    with Session(engine) as db:
        assert db.get(WearRecord, record_id) is None
        assert db.get(WearRecordTombstone, record_id).deleted_version == 1
        assert db.get(AccountRevision, owner_id).history_revision == 2


@pytest.mark.parametrize("winner", ["garment", "record"])
def test_garment_change_and_record_snapshot_are_serialized(postgres_database, winner):
    engine, owner_id, garment_id = setup_inventory(postgres_database)
    first_locked, release = Event(), Event()
    Pausing = pausing_revisions(first_locked, release)

    def act(operation, pause):
        with Session(engine) as db:
            revisions = Pausing(db) if pause else None
            if operation == "garment":
                test_garment_postgres.garments(db, revisions=revisions).patch(
                    owner_id,
                    garment_id,
                    GarmentPatch(
                        expected_version=1,
                        name="新名称",
                        category="bottoms",
                        status="archived",
                    ),
                )
                return None
            return (
                history(db, revisions)
                .create(
                    owner_id,
                    WearCreate(wear_date=DAY, garment_ids=[garment_id]),
                    "create",
                )
                .id
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(act, winner, True)
        try:
            assert first_locked.wait(timeout=10)
            second = pool.submit(
                act, "record" if winner == "garment" else "garment", False
            )
            release.set()
            ids = [first.result(timeout=15), second.result(timeout=15)]
        finally:
            release.set()
    record_id = next(value for value in ids if value is not None)
    with Session(engine) as db:
        item = history(db).get(owner_id, record_id).items[0]
        assert (item.name_snapshot, item.category_snapshot) == (
            ("新名称", "bottoms") if winner == "garment" else ("旧名称", "tops")
        )
        revision = db.get(AccountRevision, owner_id)
        assert (revision.inventory_revision, revision.history_revision) == (2, 1)


@pytest.mark.parametrize(
    "failure",
    ["receipt_create", "revision_create", "revision_patch", "revision_delete"],
)
def test_history_write_failure_is_atomic(postgres_database, failure):
    engine, owner_id, garment_id = setup_inventory(postgres_database)
    payload = WearCreate(wear_date=DAY, garment_ids=[garment_id])
    with Session(engine) as db:
        record_id = None
        if failure.endswith("patch") or failure.endswith("delete"):
            record_id = history(db).create(owner_id, payload, "create").id

        class FailingReceipt(IdempotencyRepository):
            def create(self, *args, **kwargs):
                super().create(*args, **kwargs)
                raise RuntimeError("injected receipt failure")

        class FailingRevision(RevisionRepository):
            def increment_history(self, revision):
                super().increment_history(revision)
                raise RuntimeError("injected history failure")

        service = (
            history(db, receipts=FailingReceipt(db))
            if failure.startswith("receipt")
            else history(db, revisions=FailingRevision(db))
        )
        with pytest.raises(RuntimeError, match="injected"):
            if failure.endswith("create"):
                service.create(owner_id, payload, "create")
            elif failure.endswith("patch"):
                service.patch(
                    owner_id,
                    record_id,
                    WearPatch(expected_version=1, wear_date=date(2020, 10, 21)),
                )
            else:
                service.delete(owner_id, record_id, 1)
        expected = 0 if failure.endswith("create") else 1
        assert db.scalar(select(func.count()).select_from(WearRecord)) == expected
        assert db.scalar(select(func.count()).select_from(WearRecordItem)) == expected
        assert db.scalar(select(func.count()).select_from(WearRecordTombstone)) == 0
        assert db.get(AccountRevision, owner_id).history_revision == expected
        assert db.get(AccountRevision, owner_id).inventory_revision == 1
        if record_id is not None:
            assert (
                db.get(WearRecord, record_id).version == 1
                and db.get(WearRecord, record_id).wear_date == DAY
            )
