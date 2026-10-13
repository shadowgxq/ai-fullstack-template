"""Atomic batch movement and complete HTTP lifecycle on migrated PostgreSQL."""

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
from app.schemas.bookmark import BookmarkBatchMove, BookmarkGroupWrite, BookmarkWrite
from app.services.bookmark_service import BookmarkService
from main import app
from test_bookmarks_postgres import assert_waiting_for_database_lock, await_event

postgres_engine = postgres_fixtures.postgres_engine
postgres_scope = postgres_fixtures.postgres_scope


def setup_batch(sessions, user_id):
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        source, target = [
            service.mutate(
                user_id, uuid4(), "group_create", payload=BookmarkGroupWrite(name=name)
            ).resource_id
            for name in ("Source", "Target")
        ]
        ids = [
            service.mutate(
                user_id,
                uuid4(),
                "bookmark_create",
                payload=BookmarkWrite(
                    title=f"资料 {index}",
                    url="https://example.com",
                    note=f"备注 {index}",
                    group_id=group_id,
                ),
            ).resource_id
            for index, group_id in enumerate((target, source, None))
        ]
        snapshot = service.list_bookmarks(user_id, "all", "", 1)
    return source, target, ids, snapshot


def test_batch_timestamps_stable_order_noop_and_sorted_hash_replay(postgres_scope):
    sessions, (user_id, _) = postgres_scope
    source, target, ids, before = setup_batch(sessions, user_id)
    original = {row.id: row for row in before.list}
    key = uuid4()
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        body = BookmarkBatchMove(bookmark_ids=ids, target_group_id=target)
        moved = service.mutate(user_id, key, "batch_move", payload=body)
        assert (
            moved.kind == "batch_move"
            and moved.resource_id is None
            and moved.changed_count == 2
        )
        after = service.list_bookmarks(user_id, "all", "", 1)
        rows = {row.id: row for row in after.list}
        assert rows[ids[0]] == original[ids[0]]
        assert rows[ids[1]].updated_at == rows[ids[2]].updated_at
        assert rows[ids[1]].updated_at > max(
            row.updated_at for row in original.values()
        )
        assert [row.id for row in after.list[:2]] == sorted(ids[1:], reverse=True)
        assert {row.id: row.count for row in after.groups} == {source: 0, target: 3}
        assert after.all_count == 3 and after.ungrouped_count == 0
        replay = service.mutate(
            user_id,
            key,
            "batch_move",
            payload=BookmarkBatchMove(
                bookmark_ids=list(reversed(ids)), target_group_id=target
            ),
        )
        assert (
            replay == moved and service.list_bookmarks(user_id, "all", "", 1) == after
        )
        assert (
            service.mutate(user_id, uuid4(), "batch_move", payload=body).changed_count
            == 0
        )
        assert service.list_bookmarks(user_id, "all", "", 1) == after
        with pytest.raises(BusinessException) as conflict:
            service.mutate(
                user_id,
                key,
                "batch_move",
                payload=BookmarkBatchMove(bookmark_ids=ids, target_group_id=None),
            )
        assert conflict.value.code == 40911
        assert service.resolve(user_id, key).changed_count == 2
        assert (
            service.mutate(
                user_id,
                uuid4(),
                "batch_move",
                payload=BookmarkBatchMove(bookmark_ids=ids, target_group_id=None),
            ).changed_count
            == 3
        )
        ungrouped = service.list_bookmarks(user_id, "ungrouped", "", 1)
        assert ungrouped.total == ungrouped.all_count == ungrouped.ungrouped_count == 3
        assert len({row.updated_at for row in ungrouped.list}) == 1


@pytest.mark.parametrize(
    "bad_object",
    ["missing_source", "foreign_source", "missing_target", "foreign_target"],
)
def test_batch_invalid_objects_reject_before_any_sql_change(postgres_scope, bad_object):
    sessions, (user_id, other_id) = postgres_scope
    _, target, ids, before = setup_batch(sessions, user_id)
    _, foreign_target, foreign_ids, _ = setup_batch(sessions, other_id)
    chosen_ids = ids[1:]
    if "source" in bad_object:
        chosen_ids = [
            ids[1],
            foreign_ids[0] if bad_object == "foreign_source" else uuid4(),
        ]
    else:
        target = foreign_target if bad_object == "foreign_target" else uuid4()
    key = uuid4()
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        with pytest.raises(BusinessException) as rejected:
            service.mutate(
                user_id,
                key,
                "batch_move",
                payload=BookmarkBatchMove(
                    bookmark_ids=chosen_ids, target_group_id=target
                ),
            )
        assert rejected.value.code == 40914
        assert service.list_bookmarks(user_id, "all", "", 1) == before
        failed = service.resolve(user_id, key)
        assert failed.status == "failed" and failed.error_code == 40914
        assert failed.resource_id is None and failed.changed_count == 0


@pytest.mark.parametrize("failure_type", ["runtime", "database"])
def test_batch_partial_sql_then_error_rolls_back_all_changes_and_receipt(
    postgres_scope, monkeypatch, failure_type
):
    sessions, (user_id, _) = postgres_scope
    _, target, ids, before = setup_batch(sessions, user_id)
    key = uuid4()
    with sessions() as db:
        repo = BookmarkRepository(db)
        move = repo.move_bookmarks

        def partial_then_fail(owner, selected, destination, timestamp):
            assert len(selected) == 2
            move(owner, selected[:1], destination, timestamp)
            if failure_type == "runtime":
                raise RuntimeError("simulated error after first moved row")
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

        monkeypatch.setattr(repo, "move_bookmarks", partial_then_fail)
        with pytest.raises(
            RuntimeError if failure_type == "runtime" else IntegrityError
        ):
            BookmarkService(repo).mutate(
                user_id,
                key,
                "batch_move",
                payload=BookmarkBatchMove(bookmark_ids=ids[1:], target_group_id=target),
            )
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        assert service.list_bookmarks(user_id, "all", "", 1) == before
        assert db.get(BookmarkOperation, (user_id, key)) is None
        assert service.resolve(user_id, key).status == "not_executed"


@pytest.mark.parametrize("first_action", ["move", "resolve"])
def test_batch_resolve_both_lock_orders_and_concurrent_sorted_replay(
    postgres_scope, first_action
):
    sessions, (user_id, _) = postgres_scope
    _, target, ids, before = setup_batch(sessions, user_id)
    entered, release, contender_started, replay_started = (
        Event(),
        Event(),
        Event(),
        Event(),
    )
    key = uuid4()
    pids = {}

    class PausingRepository(BookmarkRepository):
        def lock_user(self, *args, **kwargs):
            result = super().lock_user(*args, **kwargs)
            if first_action == "resolve":
                entered.set()
                await_event(release)
            return result

        def move_bookmarks(self, *args, **kwargs):
            count = super().move_bookmarks(*args, **kwargs)
            entered.set()
            await_event(release)
            return count

    def run(action, pausing):
        with sessions() as db:
            if not pausing:
                pids[action] = db.scalar(select(func.pg_backend_pid()))
                contender_started.set()
                if action == "replay":
                    replay_started.set()
            service = BookmarkService(
                PausingRepository(db) if pausing else BookmarkRepository(db)
            )
            if action == "resolve":
                return service.resolve(user_id, key)
            try:
                return service.mutate(
                    user_id,
                    key,
                    "batch_move",
                    payload=BookmarkBatchMove(
                        bookmark_ids=list(reversed(ids)) if action == "replay" else ids,
                        target_group_id=target,
                    ),
                )
            except BusinessException as exc:
                return exc.code

    with ThreadPoolExecutor(max_workers=3) as executor:
        a = executor.submit(run, first_action, True)
        await_event(entered)
        b = executor.submit(run, "resolve" if first_action == "move" else "move", False)
        await_event(contender_started)
        try:
            assert_waiting_for_database_lock(
                sessions.kw["bind"], next(iter(pids.values()))
            )
            replay = (
                executor.submit(run, "replay", False)
                if first_action == "move"
                else None
            )
            if replay is not None:
                await_event(replay_started)
                assert_waiting_for_database_lock(sessions.kw["bind"], pids["replay"])
        finally:
            release.set()
        first, second = a.result(timeout=5), b.result(timeout=5)
        if replay is not None:
            assert replay.result(timeout=5) == first
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        if first_action == "resolve":
            assert first.status == "not_executed" and second == 40913
            assert service.list_bookmarks(user_id, "all", "", 1) == before
        else:
            assert (
                first.changed_count == second.changed_count == 2
                and second.status == "succeeded"
            )
            assert second.resource_id is None and second.kind == "batch_move"
            assert {
                group.id: group.count
                for group in service.list_bookmarks(user_id, "all", "", 1).groups
            }[target] == 3


@pytest.mark.parametrize("competitor", ["delete_source", "delete_target", "edit"])
@pytest.mark.parametrize("first_action", ["move", "other"])
def test_batch_competing_delete_or_edit_serializes_both_lock_orders(
    postgres_scope, competitor, first_action
):
    sessions, (user_id, _) = postgres_scope
    source, target, ids, _ = setup_batch(sessions, user_id)
    entered, release, contender_started = Event(), Event(), Event()
    pids = {}
    move_key, other_key = uuid4(), uuid4()

    class PausingRepository(BookmarkRepository):
        def move_bookmarks(self, *args, **kwargs):
            count = super().move_bookmarks(*args, **kwargs)
            entered.set()
            await_event(release)
            return count

        def transfer_group_to_ungrouped(self, *args, **kwargs):
            count = super().transfer_group_to_ungrouped(*args, **kwargs)
            entered.set()
            await_event(release)
            return count

        def update_bookmark(self, *args, **kwargs):
            super().update_bookmark(*args, **kwargs)
            entered.set()
            await_event(release)

    def run(action, pausing):
        with sessions() as db:
            if not pausing:
                pids["other"] = db.scalar(select(func.pg_backend_pid()))
                contender_started.set()
            service = BookmarkService(
                PausingRepository(db) if pausing else BookmarkRepository(db)
            )
            try:
                if action == "move":
                    return service.mutate(
                        user_id,
                        move_key,
                        "batch_move",
                        payload=BookmarkBatchMove(
                            bookmark_ids=ids[1:], target_group_id=target
                        ),
                    )
                if competitor == "edit":
                    return service.mutate(
                        user_id,
                        other_key,
                        "bookmark_update",
                        ids[1],
                        BookmarkWrite(
                            title="Edited", url="https://example.com/new", group_id=None
                        ),
                    )
                return service.mutate(
                    user_id,
                    other_key,
                    "group_delete",
                    source if competitor == "delete_source" else target,
                    expected_count=1,
                )
            except BusinessException as exc:
                return exc.code

    with ThreadPoolExecutor(max_workers=2) as executor:
        a = executor.submit(run, first_action, True)
        await_event(entered)
        b = executor.submit(run, "other" if first_action == "move" else "move", False)
        await_event(contender_started)
        try:
            assert_waiting_for_database_lock(sessions.kw["bind"], pids["other"])
        finally:
            release.set()
        first, second = a.result(timeout=5), b.result(timeout=5)
    with sessions() as db:
        service = BookmarkService(BookmarkRepository(db))
        snapshot = service.list_bookmarks(user_id, "all", "", 1)
        rows = {row.id: row for row in snapshot.list}
        assert snapshot.all_count == 3
        if competitor == "edit":
            assert first.changed_count >= 1 and second.changed_count >= 1
            assert rows[ids[1]].title == "Edited"
            assert rows[ids[1]].group_id == (None if first_action == "move" else target)
            assert rows[ids[2]].group_id == target
        elif first_action == "move":
            assert first.changed_count == 2 and second == 40912
            assert all(row.group_id == target for row in rows.values())
            assert service.resolve(user_id, other_key).error_code == 40912
        elif competitor == "delete_target":
            assert first.changed_count == 1 and second == 40914
            assert (
                rows[ids[0]].group_id is None
                and rows[ids[1]].group_id == source
                and rows[ids[2]].group_id is None
            )
            assert service.resolve(user_id, move_key).error_code == 40914
        else:
            assert first.changed_count == 1 and second.changed_count == 2
            assert all(row.group_id == target for row in rows.values())
            assert [group.id for group in snapshot.groups] == [target]


def test_http_complete_m1_to_m3_personal_workflow(postgres_scope):
    sessions, (user_id, other_id) = postgres_scope
    with sessions() as db:
        users = [db.get(User, identity) for identity in (user_id, other_id)]
        for user in users:
            user.password_hash = hash_password("batch-api-password")
        usernames = [user.username for user in users]
        db.commit()

    def database_session():
        with sessions() as db:
            yield db

    previous = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = database_session
    try:
        with TestClient(app) as client:

            def login(name):
                response = client.post(
                    "/api/v1/auth/login",
                    json={"username": name, "password": "batch-api-password"},
                )
                assert response.status_code == 200
                return {
                    "Authorization": "Bearer " + response.json()["data"]["access_token"]
                }

            owner, other = [login(name) for name in usernames]

            def write(method, path, body=None, identity=None, key=None):
                return getattr(client, method)(
                    path,
                    headers={
                        **(identity or owner),
                        "Idempotency-Key": str(key or uuid4()),
                    },
                    **({"json": body} if body is not None else {}),
                )

            source, target = [
                write("post", "/api/v1/bookmark-groups", {"name": name}).json()["data"][
                    "resource_id"
                ]
                for name in ("HTTP Source", "HTTP Target")
            ]
            for index in range(12):
                assert (
                    write(
                        "post",
                        "/api/v1/bookmarks",
                        {
                            "title": f"Needle {index}",
                            "url": "https://example.com",
                            "group_id": source,
                            "note": "保存的备注",
                        },
                    ).status_code
                    == 200
                )
            second_page = client.get(
                "/api/v1/bookmarks",
                params={"group": source, "q": "NEEDLE", "page": 2},
                headers=owner,
            ).json()["data"]
            assert second_page["total"] == 12 and len(second_page["list"]) == 2
            ids = [row["id"] for row in second_page["list"]]
            body = {"bookmark_ids": ids, "target_group_id": target}
            assert (
                write(
                    "post", "/api/v1/bookmarks/batch-move", body, identity=other
                ).json()["code"]
                == 40914
            )
            assert (
                client.get(f"/api/v1/bookmarks/{ids[0]}", headers=other).status_code
                == 404
            )
            key = uuid4()
            moved = write("post", "/api/v1/bookmarks/batch-move", body, key=key)
            assert (
                moved.status_code == 200 and moved.json()["data"]["changed_count"] == 2
            )
            assert moved.json()["data"]["resource_id"] is None
            assert (
                write(
                    "post",
                    "/api/v1/bookmarks/batch-move",
                    {**body, "bookmark_ids": list(reversed(ids))},
                    key=key,
                ).json()["data"]
                == moved.json()["data"]
            )
            corrected = client.get(
                "/api/v1/bookmarks", params={"group": source, "page": 2}, headers=owner
            ).json()["data"]
            assert (
                corrected["page"] == 1
                and corrected["total"] == 10
                and corrected["all_count"] == 12
            )
            target_rows = client.get(
                "/api/v1/bookmarks", params={"group": target}, headers=owner
            ).json()["data"]["list"]
            assert (
                write(
                    "patch",
                    f"/api/v1/bookmark-groups/{target}",
                    {"name": "Renamed Target"},
                ).status_code
                == 200
            )
            assert (
                client.get(
                    "/api/v1/bookmarks", params={"group": target}, headers=owner
                ).json()["data"]["list"]
                == target_rows
            )
            assert (
                write(
                    "put",
                    f"/api/v1/bookmarks/{ids[0]}",
                    {
                        "title": "Edited Needle",
                        "url": "https://example.com/new",
                        "group_id": target,
                        "note": "更新备注",
                    },
                ).status_code
                == 200
            )
            owner = login(usernames[0])
            assert (
                client.get(f"/api/v1/bookmarks/{ids[0]}", headers=owner).json()["data"][
                    "note"
                ]
                == "更新备注"
            )
            assert (
                write(
                    "delete", f"/api/v1/bookmark-groups/{target}?expected_count=2"
                ).status_code
                == 200
            )
            ungrouped = client.get(
                "/api/v1/bookmarks",
                params={"group": "ungrouped", "q": "Edited"},
                headers=owner,
            ).json()["data"]
            assert (
                ungrouped["total"] == 1
                and ungrouped["all_count"] == 12
                and ungrouped["ungrouped_count"] == 2
            )
            assert write("delete", f"/api/v1/bookmarks/{ids[0]}").status_code == 200
            final = client.get("/api/v1/bookmarks", headers=owner).json()["data"]
            assert (
                final["all_count"] == 11
                and final["ungrouped_count"] == 1
                and final["groups"]
                == [{"id": source, "name": "HTTP Source", "count": 10}]
            )
            recovered = client.post(
                f"/api/v1/bookmark-operations/{key}/resolve", headers=owner
            ).json()["data"]
            assert (
                recovered["status"] == "succeeded"
                and recovered["kind"] == "batch_move"
                and recovered["changed_count"] == 2
            )
            assert recovered["resource_id"] is None
            assert (
                client.get("/api/v1/bookmarks", headers=other).json()["data"]["total"]
                == 0
            )
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous
