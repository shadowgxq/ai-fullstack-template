"""Group API/service behavior on the same explicitly isolated migrated PostgreSQL."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from uuid import uuid4

import pytest
import test_bookmarks_postgres as postgres_fixtures
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import BusinessException
from app.core.security import hash_password
from app.core.session import get_db
from app.models.bookmark import Bookmark, BookmarkOperation
from app.models.user import User
from app.repositories.bookmark_repository import BookmarkRepository
from app.schemas.bookmark import BookmarkGroupWrite, BookmarkWrite
from app.services.bookmark_service import BookmarkService
from main import app
from test_bookmarks_postgres import (
    assert_waiting_for_database_lock,
    await_event,
    count_rows,
)

postgres_engine = postgres_fixtures.postgres_engine
postgres_scope = postgres_fixtures.postgres_scope


def create_group_and_bookmarks(sessions, user_id):
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        group = service.mutate(
            user_id, uuid4(), "group_create", payload=BookmarkGroupWrite(name="Tools")
        )
        ids = [
            service.mutate(
                user_id,
                uuid4(),
                "bookmark_create",
                payload=BookmarkWrite(
                    title=f"资料 {index}",
                    url="https://example.com",
                    group_id=group.resource_id,
                ),
            ).resource_id
            for index in range(2)
        ]
        before = service.list_bookmarks(user_id, group.resource_id, "", 1)
    return group.resource_id, ids, before


def test_group_service_concurrent_name_conflict_commits_failed_and_resolves(
    postgres_scope,
):
    sessions, (user_id, _) = postgres_scope
    entered, release, contender_started, resolve_started = (
        Event(),
        Event(),
        Event(),
        Event(),
    )
    first_key, duplicate_key = uuid4(), uuid4()
    pids = {}

    class PausingRepository(BookmarkRepository):
        def create_group(self, *args, **kwargs):
            group = super().create_group(*args, **kwargs)
            entered.set()
            await_event(release)
            return group

    def first():
        with sessions() as db:
            return BookmarkService(PausingRepository(db)).mutate(
                user_id,
                first_key,
                "group_create",
                payload=BookmarkGroupWrite(name=" Tools "),
            )

    def duplicate():
        with sessions() as db:
            pids["duplicate"] = db.scalar(select(func.pg_backend_pid()))
            contender_started.set()
            with pytest.raises(BusinessException) as rejected:
                BookmarkService(BookmarkRepository(db)).mutate(
                    user_id,
                    duplicate_key,
                    "group_create",
                    payload=BookmarkGroupWrite(name="TOOLS"),
                )
            return rejected.value.code

    def resolve():
        with sessions() as db:
            pids["resolve"] = db.scalar(select(func.pg_backend_pid()))
            resolve_started.set()
            return BookmarkService(BookmarkRepository(db)).resolve(user_id, first_key)

    with ThreadPoolExecutor(max_workers=3) as executor:
        a = executor.submit(first)
        await_event(entered)
        b, c = executor.submit(duplicate), executor.submit(resolve)
        await_event(contender_started)
        await_event(resolve_started)
        try:
            for pid in pids.values():
                assert_waiting_for_database_lock(sessions.kw["bind"], pid)
        finally:
            release.set()
        created, rejected, resolved = (
            a.result(timeout=5),
            b.result(timeout=5),
            c.result(timeout=5),
        )
    assert rejected == 40910 and resolved.status == "succeeded"
    assert (
        resolved.kind == "group_create" and resolved.resource_id == created.resource_id
    )
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        failed = service.resolve(user_id, duplicate_key)
        assert failed.status == "failed" and failed.error_code == 40910
        assert failed.resource_id is None and failed.changed_count == 0
        assert len(service.list_bookmarks(user_id, "all", "", 1).groups) == 1
        with pytest.raises(BusinessException) as repeated:
            service.mutate(
                user_id,
                duplicate_key,
                "group_create",
                payload=BookmarkGroupWrite(name="TOOLS"),
            )
        assert repeated.value.code == 40910


@pytest.mark.parametrize("first_action", ["delete", "write"])
@pytest.mark.parametrize("write_kind", ["bookmark_create", "bookmark_update"])
def test_group_delete_and_bookmark_write_share_lock_in_both_orders(
    postgres_scope, first_action, write_kind
):
    sessions, (user_id, _) = postgres_scope
    group_id, ids, before = create_group_and_bookmarks(sessions, user_id)
    entered, release, contender_started = Event(), Event(), Event()
    key, write_key = uuid4(), uuid4()
    pids = {}

    class PausingRepository(BookmarkRepository):
        def transfer_group_to_ungrouped(self, *args, **kwargs):
            count = super().transfer_group_to_ungrouped(*args, **kwargs)
            if first_action == "delete":
                entered.set()
                await_event(release)
            return count

        def create_bookmark(self, *args, **kwargs):
            result = super().create_bookmark(*args, **kwargs)
            entered.set()
            await_event(release)
            return result

        def update_bookmark(self, *args, **kwargs):
            super().update_bookmark(*args, **kwargs)
            entered.set()
            await_event(release)

    def run(action, pausing):
        with sessions() as db:
            if not pausing:
                pids["contender"] = db.scalar(select(func.pg_backend_pid()))
                contender_started.set()
            service = BookmarkService(
                PausingRepository(db) if pausing else BookmarkRepository(db)
            )
            try:
                if action == "delete":
                    return service.mutate(
                        user_id, key, "group_delete", group_id, expected_count=2
                    )
                return service.mutate(
                    user_id,
                    write_key,
                    write_kind,
                    ids[0] if write_kind == "bookmark_update" else None,
                    BookmarkWrite(
                        title="Late write",
                        url="https://example.com/new",
                        group_id=group_id,
                    ),
                )
            except BusinessException as exc:
                return exc.code

    other_action = "write" if first_action == "delete" else "delete"
    with ThreadPoolExecutor(max_workers=2) as executor:
        a = executor.submit(run, first_action, True)
        await_event(entered)
        b = executor.submit(run, other_action, False)
        await_event(contender_started)
        try:
            assert_waiting_for_database_lock(sessions.kw["bind"], pids["contender"])
        finally:
            release.set()
        first, second = a.result(timeout=5), b.result(timeout=5)
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        snapshot = service.list_bookmarks(user_id, "all", "", 1)
        if first_action == "write" and write_kind == "bookmark_create":
            assert first.changed_count == 1 and second == 40912
            assert snapshot.total == 3 and snapshot.ungrouped_count == 0
            assert snapshot.groups[0].count == 3
            assert service.resolve(user_id, key).error_code == 40912
        else:
            deleted = first if first_action == "delete" else second
            assert deleted.kind == "group_delete" and deleted.changed_count == 2
            assert snapshot.total == snapshot.ungrouped_count == before.total == 2
            assert snapshot.groups == [] and all(
                row.group_id is None for row in snapshot.list
            )
            assert len({row.updated_at for row in snapshot.list}) == 1
            assert all(
                row.updated_at > before.list[0].updated_at for row in snapshot.list
            )
            assert [row.id for row in snapshot.list] == sorted(ids, reverse=True)
            if first_action == "delete":
                assert (
                    second == 40410
                    and service.resolve(user_id, write_key).status == "failed"
                )
            else:
                assert (
                    next(row.title for row in snapshot.list if row.id == ids[0])
                    == "Late write"
                )


@pytest.mark.parametrize("failure_type", ["runtime", "database"])
def test_group_delete_midway_failure_rolls_back_all_transfers(
    postgres_scope, monkeypatch, failure_type
):
    sessions, (user_id, _) = postgres_scope
    group_id, _, before = create_group_and_bookmarks(sessions, user_id)
    key = uuid4()
    with sessions() as db:
        repo = BookmarkRepository(db)

        def fail_delete(group):
            if failure_type == "runtime":
                raise RuntimeError("simulated local error after SQL transfer")
            db.add(
                Bookmark(
                    user_id=user_id,
                    group_id=uuid4(),
                    title="invalid FK",
                    url="https://example.com",
                    note="",
                )
            )
            db.flush()

        monkeypatch.setattr(repo, "delete_group", fail_delete)
        with pytest.raises(
            RuntimeError if failure_type == "runtime" else IntegrityError
        ):
            BookmarkService(repo).mutate(
                user_id, key, "group_delete", group_id, expected_count=2
            )
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        after = service.list_bookmarks(user_id, group_id, "", 1)
        assert after == before
        assert db.get(BookmarkOperation, (user_id, key)) is None
        assert service.resolve(user_id, key).status == "not_executed"
        assert (
            service.mutate(
                user_id, uuid4(), "group_delete", group_id, expected_count=2
            ).changed_count
            == 2
        )


def test_unrelated_integrity_error_is_not_group_name_conflict(
    postgres_scope, monkeypatch
):
    sessions, (user_id, _) = postgres_scope
    key = uuid4()
    with sessions() as db:
        repo = BookmarkRepository(db)
        create_group = repo.create_group

        def invalid_related_write(*args, **kwargs):
            result = create_group(*args, **kwargs)
            db.add(
                Bookmark(
                    user_id=user_id,
                    group_id=uuid4(),
                    title="invalid FK",
                    url="https://example.com",
                    note="",
                )
            )
            db.flush()
            return result

        monkeypatch.setattr(repo, "create_group", invalid_related_write)
        with pytest.raises(IntegrityError) as failure:
            BookmarkService(repo).mutate(
                user_id,
                key,
                "group_create",
                payload=BookmarkGroupWrite(name="Valid name"),
            )
        assert failure.value.orig.diag.constraint_name == "fk_bookmarks_owned_group"
    with sessions() as db:
        assert (
            BookmarkService(BookmarkRepository(db))
            .list_bookmarks(user_id, "all", "", 1)
            .groups
            == []
        )
    assert count_rows(sessions, BookmarkOperation, user_id) == 0


def test_http_m1_to_group_management_lifecycle_with_real_auth(postgres_scope):
    sessions, (user_id, other_id) = postgres_scope
    with sessions() as db:
        users = [db.get(User, identity) for identity in (user_id, other_id)]
        for user in users:
            user.password_hash = hash_password("groups-api-password")
        usernames = [user.username for user in users]
        db.commit()

    def database_session():
        with sessions() as db:
            yield db

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = database_session
    try:
        with TestClient(app) as client:
            tokens = [
                client.post(
                    "/api/v1/auth/login",
                    json={"username": name, "password": "groups-api-password"},
                ).json()["data"]["access_token"]
                for name in usernames
            ]
            owner_headers = {"Authorization": f"Bearer {tokens[0]}"}
            other_headers = {"Authorization": f"Bearer {tokens[1]}"}

            def write(method, path, body=None, headers=None):
                return getattr(client, method)(
                    path,
                    headers={
                        **(headers or owner_headers),
                        "Idempotency-Key": str(uuid4()),
                    },
                    **({"json": body} if body is not None else {}),
                )

            created = write("post", "/api/v1/bookmark-groups", {"name": "HTTP 研究"})
            assert created.status_code == 200
            group_id = created.json()["data"]["resource_id"]
            group_path = f"/api/v1/bookmark-groups/{group_id}"
            body = {
                "title": "needle 订阅",
                "url": "https://example.com",
                "group_id": group_id,
                "note": "备注",
            }
            first = write("post", "/api/v1/bookmarks", body).json()["data"][
                "resource_id"
            ]
            second = write(
                "post",
                "/api/v1/bookmarks",
                {**body, "title": "其他资料", "group_id": None},
            ).json()["data"]["resource_id"]
            assert (
                write(
                    "put", f"/api/v1/bookmarks/{second}", {**body, "title": "其他资料"}
                ).status_code
                == 200
            )
            before = client.get(
                "/api/v1/bookmarks", params={"group": group_id}, headers=owner_headers
            ).json()["data"]
            assert before["total"] == before["groups"][0]["count"] == 2
            search = client.get(
                "/api/v1/bookmarks",
                params={"group": group_id, "q": "NEEDLE"},
                headers=owner_headers,
            ).json()["data"]
            assert (
                search["total"] == 1
                and search["list"][0]["id"] == first
                and search["groups"][0]["count"] == 2
            )
            assert (
                write("patch", group_path, {"name": "HTTP 新名称"}).status_code == 200
            )
            renamed = client.get(
                "/api/v1/bookmarks", params={"group": group_id}, headers=owner_headers
            ).json()["data"]
            assert (
                renamed["list"] == before["list"]
                and renamed["groups"][0]["name"] == "HTTP 新名称"
            )
            assert (
                write(
                    "delete", group_path + "?expected_count=2", headers=other_headers
                ).status_code
                == 404
            )
            impact_key = uuid4()
            wrong = client.delete(
                group_path,
                params={"expected_count": 1},
                headers={**owner_headers, "Idempotency-Key": str(impact_key)},
            )
            assert wrong.status_code == 409 and wrong.json()["code"] == 40912
            assert (
                client.post(
                    f"/api/v1/bookmark-operations/{impact_key}/resolve",
                    headers=owner_headers,
                ).json()["data"]["error_code"]
                == 40912
            )
            delete_key = uuid4()
            removed = client.delete(
                group_path,
                params={"expected_count": 2},
                headers={**owner_headers, "Idempotency-Key": str(delete_key)},
            )
            assert (
                removed.status_code == 200
                and removed.json()["data"]["changed_count"] == 2
            )
            snapshot = client.get(
                "/api/v1/bookmarks",
                params={"group": "ungrouped", "q": "needle", "page": 999},
                headers=owner_headers,
            ).json()["data"]
            assert (
                snapshot["total"] == 1
                and snapshot["all_count"] == snapshot["ungrouped_count"] == 2
            )
            assert snapshot["page"] == 1 and snapshot["groups"] == []
            assert (
                client.get(
                    "/api/v1/bookmarks",
                    params={"group": group_id},
                    headers=owner_headers,
                ).status_code
                == 404
            )
            resolved = client.post(
                f"/api/v1/bookmark-operations/{delete_key}/resolve",
                headers=owner_headers,
            ).json()["data"]
            assert (
                resolved["status"] == "succeeded" and resolved["kind"] == "group_delete"
            )
            assert (
                resolved["resource_id"] == group_id and resolved["changed_count"] == 2
            )
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
