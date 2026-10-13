"""Real migrated PostgreSQL constraints, account locks and receipt atomicity.

Run only against an explicitly named local test database through
BOOKMARKS_TEST_DATABASE_URL. Every invocation creates and removes its own schema.
SQLite/fake Redis tests cannot prove these guarantees.
"""

import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from threading import Event
from uuid import UUID, uuid4

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, func, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.base import Base
from app.core.config import settings
from app.core.exceptions import BusinessException
from app.core.security import hash_password
from app.core.session import get_db
from app.models.bookmark import Bookmark, BookmarkGroup, BookmarkOperation
from app.models.user import User
from app.repositories.bookmark_repository import BookmarkRepository
from app.schemas.bookmark import BookmarkWrite
from app.services.bookmark_service import BookmarkService
from main import app


@pytest.fixture(scope="module")
def postgres_engine():
    raw_url = os.environ.get("BOOKMARKS_TEST_DATABASE_URL")
    if not raw_url:
        pytest.skip(
            "BOOKMARKS_TEST_DATABASE_URL is not configured; no PostgreSQL proof"
        )
    url = make_url(raw_url)
    if (
        url.get_backend_name() != "postgresql"
        or url.host not in {"127.0.0.1", "localhost", "::1"}
        or "test" not in (url.database or "").lower()
    ):
        pytest.fail(
            "Bookmark PostgreSQL checks require an explicitly named local test database"
        )
    schema = "bookmarks_test_" + uuid4().hex
    assert re.fullmatch(r"bookmarks_test_[0-9a-f]{32}", schema)
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.execute(text(f"CREATE SCHEMA {schema}"))
    isolated_url = url.update_query_dict({"options": f"-csearch_path={schema}"})
    engine = create_engine(isolated_url, pool_size=8, max_overflow=4)
    original_url = settings.database_url
    try:
        # The actual Alembic environment/versions run against this fresh schema;
        # no create_all shortcut is used for PostgreSQL integration evidence.
        settings.database_url = isolated_url.render_as_string(hide_password=False)
        command.upgrade(
            Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head"
        )
        settings.database_url = original_url
        yield engine
    finally:
        settings.database_url = original_url
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f"DROP SCHEMA {schema} CASCADE"))
        admin.dispose()


@pytest.fixture
def postgres_scope(postgres_engine):
    sessions = sessionmaker(bind=postgres_engine, autoflush=False)
    with sessions() as db:
        users = [User(username=uuid4().hex, password_hash="unused") for _ in range(2)]
        db.add_all(users)
        db.commit()
        ids = (users[0].id, users[1].id)
    yield sessions, ids
    with sessions() as db:
        # Remove bookmarks first because group deletion deliberately uses RESTRICT.
        db.execute(delete(Bookmark).where(Bookmark.user_id.in_(ids)))
        db.execute(delete(User).where(User.id.in_(ids)))
        db.commit()


def draft(**changes) -> BookmarkWrite:
    return BookmarkWrite(
        title="订阅 😀", url="https://example.com/A?q=%#hash", note="备注", **changes
    )


def count_rows(sessions, model, user_id):
    with sessions() as db:
        return db.scalar(
            select(func.count()).select_from(model).where(model.user_id == user_id)
        )


def await_event(event: Event) -> None:
    assert event.wait(5), (
        "Concurrent test did not reach its intended transaction boundary"
    )


def assert_waiting_for_database_lock(engine, pid: int) -> None:
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        with engine.connect() as connection:
            waiting = connection.scalar(
                text("SELECT wait_event_type FROM pg_stat_activity WHERE pid=:pid"),
                {"pid": pid},
            )
        if waiting == "Lock":
            return
        time.sleep(0.02)
    pytest.fail("Competing transaction never demonstrably waited for a PostgreSQL lock")


def test_migrated_schema_matches_registered_models(postgres_engine):
    assert set(inspect(postgres_engine).get_table_names()) == {
        "users",
        "bookmark_groups",
        "bookmarks",
        "bookmark_operations",
        "alembic_version",
    }
    with postgres_engine.connect() as connection:
        assert (
            connection.scalar(text("SELECT version_num FROM alembic_version"))
            == "260262a67b12"
        )
        assert (
            compare_metadata(MigrationContext.configure(connection), Base.metadata)
            == []
        )
    indexes = {
        index["name"] for index in inspect(postgres_engine).get_indexes("bookmarks")
    }
    assert indexes == {"ix_bookmarks_owner_updated", "ix_bookmarks_owner_group_updated"}


def test_http_lifecycle_with_real_bearer_auth_and_postgresql(postgres_scope):
    sessions, (user_id, other_id) = postgres_scope
    password = "pg-api-only-password"
    with sessions() as db:
        users = [db.get(User, identity) for identity in (user_id, other_id)]
        for user in users:
            user.password_hash = hash_password(password)
        usernames = [user.username for user in users]
        db.commit()

    def database_session():
        with sessions() as db:
            yield db

    # Override only the Session boundary. JWT decoding, revocation/cache reads,
    # owner resolution, API schemas and domain transaction code run unchanged.
    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = database_session
    try:
        with TestClient(app) as client:

            def login(username):
                response = client.post(
                    "/api/v1/auth/login",
                    json={"username": username, "password": password},
                )
                assert response.status_code == 200
                return response.json()["data"]["access_token"]

            token, other_token = [login(username) for username in usernames]
            owner_headers = {"Authorization": f"Bearer {token}"}
            other_headers = {"Authorization": f"Bearer {other_token}"}
            key = uuid4()
            body = {
                "title": "HTTP 订阅 100%",
                "url": "https://example.com/A?q=Keep#part",
                "note": "原始备注",
                "group_id": None,
            }
            headers = {**owner_headers, "Idempotency-Key": str(key)}
            saved = client.post("/api/v1/bookmarks", json=body, headers=headers)
            assert saved.status_code == 200
            receipt = saved.json()["data"]
            bookmark_id = receipt["resource_id"]
            path = f"/api/v1/bookmarks/{bookmark_id}"
            assert (
                client.post("/api/v1/bookmarks", json=body, headers=headers).json()[
                    "data"
                ]
                == receipt
            )
            for index in range(11):
                response = client.post(
                    "/api/v1/bookmarks",
                    json={**body, "title": f"其他资料 {index}"},
                    headers={**owner_headers, "Idempotency-Key": str(uuid4())},
                )
                assert response.status_code == 200
            listed = client.get(
                "/api/v1/bookmarks", params={"page": 999}, headers=owner_headers
            ).json()["data"]
            assert listed["page"] == 2 and len(listed["list"]) == 2
            assert (
                listed["total"]
                == listed["all_count"]
                == listed["ungrouped_count"]
                == 12
            )
            found = client.get(
                "/api/v1/bookmarks",
                params={"q": " http 订阅 100% "},
                headers=owner_headers,
            ).json()["data"]
            assert found["total"] == 1 and found["list"][0]["id"] == bookmark_id
            assert found["all_count"] == 12
            original = client.get(path, headers=owner_headers).json()["data"]
            edited_body = {**body, "title": "HTTP 更新 100%", "note": "更新后的备注"}
            edited = client.put(
                path,
                json=edited_body,
                headers={**owner_headers, "Idempotency-Key": str(uuid4())},
            )
            assert (
                edited.status_code == 200
                and edited.json()["data"]["kind"] == "bookmark_update"
            )
            new_token = login(usernames[0])
            assert new_token != token
            revisited_headers = {"Authorization": f"Bearer {new_token}"}
            revisited = client.get(path, headers=revisited_headers).json()["data"]
            assert (
                revisited["title"] == edited_body["title"]
                and revisited["note"] == edited_body["note"]
            )
            assert (
                revisited["url"] == body["url"]
                and revisited["updated_at"] > original["updated_at"]
            )
            for method in ("get", "put", "delete"):
                response = getattr(client, method)(
                    path,
                    headers={**other_headers, "Idempotency-Key": str(uuid4())},
                    **({"json": edited_body} if method == "put" else {}),
                )
                assert response.status_code == 404 and response.json()["code"] == 40410
            assert (
                client.get("/api/v1/bookmarks", headers=other_headers).json()["data"][
                    "total"
                ]
                == 0
            )
            resolved = client.post(
                f"/api/v1/bookmark-operations/{key}/resolve", headers=revisited_headers
            ).json()["data"]
            assert (
                resolved["status"] == "succeeded"
                and resolved["kind"] == "bookmark_create"
            )
            assert (
                resolved["resource_id"] == bookmark_id
                and resolved["changed_count"] == 1
            )
            assert resolved["error_code"] is None
            deleted = client.delete(
                path, headers={**revisited_headers, "Idempotency-Key": str(uuid4())}
            )
            assert (
                deleted.status_code == 200
                and deleted.json()["data"]["kind"] == "bookmark_delete"
            )
            assert client.get(path, headers=revisited_headers).status_code == 404
            assert (
                client.get("/api/v1/bookmarks", headers=revisited_headers).json()[
                    "data"
                ]["total"]
                == 11
            )
            assert (
                client.post(
                    f"/api/v1/bookmark-operations/{key}/resolve",
                    headers=revisited_headers,
                ).json()["data"]
                == resolved
            )
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous


def test_owned_group_fk_name_unique_and_restrict(postgres_scope):
    sessions, (user_id, other_id) = postgres_scope
    with sessions() as db:
        group = BookmarkGroup(user_id=user_id, name="Tools", name_key="tools")
        db.add(group)
        db.commit()
        group_id = group.id
        db.add(BookmarkGroup(user_id=user_id, name="TOOLS", name_key="tools"))
        with pytest.raises(IntegrityError) as duplicate:
            db.commit()
        assert duplicate.value.orig.diag.constraint_name == "uq_bookmark_groups_name"
        db.rollback()
        db.add(
            Bookmark(
                user_id=other_id,
                group_id=group_id,
                title="foreign",
                url="https://example.com",
                note="",
            )
        )
        with pytest.raises(IntegrityError) as foreign:
            db.commit()
        assert foreign.value.orig.diag.constraint_name == "fk_bookmarks_owned_group"
        db.rollback()
        result = BookmarkService(BookmarkRepository(db)).mutate(
            user_id, uuid4(), "bookmark_create", payload=draft(group_id=group_id)
        )
        with pytest.raises(IntegrityError):
            db.execute(delete(BookmarkGroup).where(BookmarkGroup.id == group_id))
            db.commit()
        db.rollback()
        assert (
            BookmarkService(BookmarkRepository(db))
            .get_bookmark(user_id, result.resource_id)
            .group_id
            == group_id
        )


def test_account_fk_cascades_all_owned_business_rows(postgres_scope):
    sessions, (user_id, _) = postgres_scope
    with sessions() as db:
        group = BookmarkGroup(user_id=user_id, name="Owned", name_key="owned")
        db.add(group)
        db.commit()
        BookmarkService(BookmarkRepository(db)).mutate(
            user_id, uuid4(), "bookmark_create", payload=draft(group_id=group.id)
        )
        db.execute(delete(User).where(User.id == user_id))
        db.commit()
    for model in (Bookmark, BookmarkGroup, BookmarkOperation):
        assert count_rows(sessions, model, user_id) == 0


def test_parallel_group_name_constraint_is_database_enforced(postgres_scope):
    sessions, (user_id, _) = postgres_scope
    entered, release, contender_started = Event(), Event(), Event()
    pids = {}

    def first():
        with sessions() as db:
            db.add(BookmarkGroup(user_id=user_id, name="Tools", name_key="tools"))
            db.flush()
            entered.set()
            await_event(release)
            db.commit()

    def second():
        with sessions() as db:
            pids["second"] = db.scalar(select(func.pg_backend_pid()))
            contender_started.set()
            db.add(BookmarkGroup(user_id=user_id, name="TOOLS", name_key="tools"))
            try:
                db.commit()
            except IntegrityError as exc:
                db.rollback()
                return exc.orig.diag.constraint_name
            return None

    with ThreadPoolExecutor(max_workers=2) as executor:
        a = executor.submit(first)
        await_event(entered)
        b = executor.submit(second)
        await_event(contender_started)
        try:
            assert_waiting_for_database_lock(sessions.kw["bind"], pids["second"])
        finally:
            release.set()
        a.result(timeout=5)
        assert b.result(timeout=5) == "uq_bookmark_groups_name"
    assert count_rows(sessions, BookmarkGroup, user_id) == 1


@pytest.mark.parametrize("failure_type", ["runtime", "database"])
def test_bookmark_and_receipt_rollback_together_on_unexpected_error(
    postgres_scope, monkeypatch, failure_type
):
    sessions, (user_id, _) = postgres_scope
    key = uuid4()
    with sessions() as db:
        repo = BookmarkRepository(db)
        add_operation = repo.add_operation

        def fail_receipt(*args, **kwargs):
            if failure_type == "runtime":
                raise RuntimeError("simulated local failure after resource mutation")
            arguments = list(args)
            arguments[4] = "invalid_status"
            return add_operation(*arguments, **kwargs)

        monkeypatch.setattr(repo, "add_operation", fail_receipt)
        with pytest.raises(
            RuntimeError if failure_type == "runtime" else IntegrityError
        ):
            BookmarkService(repo).mutate(
                user_id, key, "bookmark_create", payload=draft()
            )
    assert count_rows(sessions, Bookmark, user_id) == 0
    assert count_rows(sessions, BookmarkOperation, user_id) == 0
    with sessions() as db:
        result = BookmarkService(BookmarkRepository(db)).resolve(user_id, key)
        assert result.status == "not_executed"


def test_business_failure_is_a_committed_replayable_receipt(postgres_scope):
    sessions, (user_id, other_id) = postgres_scope
    with sessions() as db:
        foreign = BookmarkGroup(user_id=other_id, name="Private", name_key="private")
        db.add(foreign)
        db.commit()
        group_id = foreign.id
    key = uuid4()
    for _ in range(2):
        with sessions() as db:
            with pytest.raises(BusinessException) as rejected:
                BookmarkService(BookmarkRepository(db)).mutate(
                    user_id, key, "bookmark_create", payload=draft(group_id=group_id)
                )
            assert rejected.value.code == 40410
    with sessions() as db:
        receipt = BookmarkService(BookmarkRepository(db)).resolve(user_id, key)
        assert receipt.status == "failed" and receipt.error_code == 40410
    assert count_rows(sessions, BookmarkOperation, user_id) == 1
    assert count_rows(sessions, Bookmark, user_id) == 0


def test_concurrent_duplicate_key_mutates_once_and_resolve_waits(postgres_scope):
    sessions, (user_id, other_id) = postgres_scope
    entered, release, contender_started, resolve_started = (
        Event(),
        Event(),
        Event(),
        Event(),
    )
    pids = {}
    key = uuid4()

    class PausingRepository(BookmarkRepository):
        def create_bookmark(self, *args, **kwargs):
            bookmark = super().create_bookmark(*args, **kwargs)
            entered.set()
            await_event(release)
            return bookmark

    def first_write():
        with sessions() as db:
            return BookmarkService(PausingRepository(db)).mutate(
                user_id, key, "bookmark_create", payload=draft()
            )

    def second_write():
        with sessions() as db:
            pids["write"] = db.scalar(select(func.pg_backend_pid()))
            contender_started.set()
            return BookmarkService(BookmarkRepository(db)).mutate(
                user_id, key, "bookmark_create", payload=draft()
            )

    def resolve():
        with sessions() as db:
            pids["resolve"] = db.scalar(select(func.pg_backend_pid()))
            resolve_started.set()
            return BookmarkService(BookmarkRepository(db)).resolve(user_id, key)

    with ThreadPoolExecutor(max_workers=3) as executor:
        a = executor.submit(first_write)
        await_event(entered)
        b = executor.submit(second_write)
        c = executor.submit(resolve)
        await_event(contender_started)
        await_event(resolve_started)
        try:
            assert_waiting_for_database_lock(sessions.kw["bind"], pids["write"])
            assert_waiting_for_database_lock(sessions.kw["bind"], pids["resolve"])
            # The lock is per account, not a global bookmark serialization point.
            with sessions() as db:
                other = BookmarkService(BookmarkRepository(db)).mutate(
                    other_id, uuid4(), "bookmark_create", payload=draft()
                )
                assert other.changed_count == 1
        finally:
            release.set()
        first, replay, resolved = (
            a.result(timeout=5),
            b.result(timeout=5),
            c.result(timeout=5),
        )
    assert first == replay
    assert resolved.status == "succeeded" and resolved.resource_id == first.resource_id
    assert count_rows(sessions, Bookmark, user_id) == 1
    assert count_rows(sessions, BookmarkOperation, user_id) == 1
    # Losing a response cannot delete a committed receipt; a fresh session recovers it.
    with sessions() as db:
        assert BookmarkService(BookmarkRepository(db)).resolve(user_id, key) == resolved


def test_resolve_wins_lock_before_late_write_and_fences_it(postgres_scope):
    sessions, (user_id, _) = postgres_scope
    locked, release, contender_started = Event(), Event(), Event()
    key = uuid4()
    pids = {}

    class PausingRepository(BookmarkRepository):
        def lock_user(self, user_id, *, shared=False):
            result = super().lock_user(user_id, shared=shared)
            locked.set()
            await_event(release)
            return result

    def resolve():
        with sessions() as db:
            return BookmarkService(PausingRepository(db)).resolve(user_id, key)

    def late_write():
        with sessions() as db:
            pids["late"] = db.scalar(select(func.pg_backend_pid()))
            contender_started.set()
            with pytest.raises(BusinessException) as prevented:
                BookmarkService(BookmarkRepository(db)).mutate(
                    user_id, key, "bookmark_create", payload=draft()
                )
            return prevented.value.code

    with ThreadPoolExecutor(max_workers=2) as executor:
        a = executor.submit(resolve)
        await_event(locked)
        b = executor.submit(late_write)
        await_event(contender_started)
        try:
            assert_waiting_for_database_lock(sessions.kw["bind"], pids["late"])
        finally:
            release.set()
        assert a.result(timeout=5).status == "not_executed"
        assert b.result(timeout=5) == 40913
    assert count_rows(sessions, Bookmark, user_id) == 0
    assert count_rows(sessions, BookmarkOperation, user_id) == 1


def test_list_shared_lock_holds_consistent_snapshot_while_write_waits(postgres_scope):
    sessions, (user_id, _) = postgres_scope
    entered, release, writer_started = Event(), Event(), Event()
    pids = {}

    class PausingRepository(BookmarkRepository):
        def list_snapshot(self, *args, **kwargs):
            entered.set()
            await_event(release)
            return super().list_snapshot(*args, **kwargs)

    def read():
        with sessions() as db:
            return BookmarkService(PausingRepository(db)).list_bookmarks(
                user_id, "all", "", 1
            )

    def write():
        with sessions() as db:
            pids["write"] = db.scalar(select(func.pg_backend_pid()))
            writer_started.set()
            return BookmarkService(BookmarkRepository(db)).mutate(
                user_id, uuid4(), "bookmark_create", payload=draft()
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        a = executor.submit(read)
        await_event(entered)
        b = executor.submit(write)
        await_event(writer_started)
        try:
            assert_waiting_for_database_lock(sessions.kw["bind"], pids["write"])
        finally:
            release.set()
        snapshot = a.result(timeout=5)
        b.result(timeout=5)
    assert snapshot.total == snapshot.all_count == snapshot.ungrouped_count == 0
    assert snapshot.list == []
    with sessions() as db:
        assert (
            BookmarkService(BookmarkRepository(db))
            .list_bookmarks(user_id, "all", "", 1)
            .total
            == 1
        )


def test_real_search_stable_sort_and_full_group_snapshot_cost(postgres_scope):
    sessions, (user_id, _) = postgres_scope
    timestamp = datetime.now(timezone.utc)
    with sessions() as db:
        groups = [
            BookmarkGroup(user_id=user_id, name=f"组{index}", name_key=f"组{index}")
            for index in range(1000)
        ]
        db.add_all(groups)
        db.flush()
        group_id = groups[0].id
        rows = [
            Bookmark(
                id=UUID(int=index + 1),
                user_id=user_id,
                group_id=group_id if index % 2 else None,
                title=f"Title {index} 中文😀",
                url="https://example.com/%_\\"
                if index == 0
                else "https://example.com/A",
                note="not searched",
                created_at=timestamp,
                updated_at=timestamp,
            )
            for index in range(500)
        ]
        db.add_all(rows)
        db.commit()
        started = time.monotonic()
        service = BookmarkService(BookmarkRepository(db))
        result = service.list_bookmarks(user_id, "all", " tItLe ", 999)
        elapsed = time.monotonic() - started
        assert result.page == 50 and result.total == result.all_count == 500
        assert result.ungrouped_count == 250 and len(result.groups) == 1000
        assert [row.id.int for row in result.list] == list(range(10, 0, -1))
        assert elapsed < 5, f"Full 1000-group snapshot took {elapsed:.2f}s"
        assert service.list_bookmarks(user_id, "all", "%_\\", 1).total == 1
        assert service.list_bookmarks(user_id, group_id, "中文😀", 1).total == 250
        assert service.list_bookmarks(user_id, "all", "NOT SEARCHED", 1).total == 0
        # Only ASCII folding is specified; PostgreSQL locale must not fold Ä.
        rows[0].title = "Ä"
        db.commit()
        assert service.list_bookmarks(user_id, "all", "ä", 1).total == 0
        before = service.get_bookmark(user_id, rows[1].id)
        key = uuid4()
        service.mutate(
            user_id, key, "bookmark_update", rows[1].id, draft(group_id=group_id)
        )
        after = service.get_bookmark(user_id, rows[1].id)
        assert after.updated_at > before.updated_at
        assert service.list_bookmarks(user_id, "all", "", 1).list[0].id == after.id
        unchanged = BookmarkWrite(
            title=after.title, url=after.url, group_id=after.group_id, note=after.note
        )
        service.mutate(user_id, uuid4(), "bookmark_update", after.id, unchanged)
        assert service.get_bookmark(user_id, after.id).updated_at > after.updated_at
