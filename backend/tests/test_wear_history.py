"""真实 HTTP/ORM 的穿着事实；锁和竞争另以 PostgreSQL 检查。"""

from datetime import date, datetime, timezone
from io import BytesIO
from uuid import UUID, uuid4

from fastapi import Depends
from PIL import Image
import pytest
from sqlalchemy import event, func, select

from app.api.dependencies import get_wear_service, get_recommendation_service
from app.core.session import get_db
from app.models.account_revision import AccountRevision
from app.models.idempotency_receipt import IdempotencyReceipt
from app.models.wear_record import WearRecord, WearRecordItem, WearRecordTombstone
from app.repositories.garment_repository import GarmentRepository
from app.repositories.idempotency_repository import IdempotencyRepository
from app.repositories.media_repository import MediaRepository
from app.repositories.revision_repository import RevisionRepository
from app.repositories.wear_repository import WearRepository
from app.services.media_service import MediaService
from app.services.media_store import MediaStore
from app.services.wear_service import WearService
from main import app
import test_garments

owner = test_garments.owner
TODAY = "2020-10-22"


def wear_service(db, **kwargs):
    return WearService(
        WearRepository(db),
        GarmentRepository(db),
        RevisionRepository(db),
        IdempotencyRepository(db),
        "cursor-test",
        recommendations=get_recommendation_service(db),
        **kwargs,
    )


def garment(client, headers, name="旧名称", category="tops"):
    response = test_garments.create(
        client, headers, {"name": name, "category": category}, key=str(uuid4())
    )
    assert response.status_code == 200
    return response.json()["data"]["id"]


def create(client, headers, ids, wear_date=TODAY, key="record-key"):
    return client.post(
        "/api/v1/wear-records",
        headers={**headers, "Idempotency-Key": key},
        json={"wear_date": wear_date, "garment_ids": ids},
    )


def count(client, headers, garment_id):
    return client.get(f"/api/v1/garments/{garment_id}", headers=headers).json()["data"][
        "wear_count"
    ]


def test_all_states_dedup_receipt_versions_and_delete_tombstone(
    client, db_session, owner
):
    owner_id, headers = owner
    ids = [garment(client, headers) for _ in range(3)]
    for garment_id, status in zip(ids[1:], ("unavailable", "archived")):
        assert (
            client.patch(
                f"/api/v1/garments/{garment_id}",
                headers=headers,
                json={"expected_version": 1, "status": status},
            ).status_code
            == 200
        )
    inventory = db_session.get(AccountRevision, owner_id).inventory_revision
    first = create(client, headers, [*ids, ids[0]])
    assert first.status_code == 200
    receipt = first.json()["data"]
    assert create(client, headers, list(reversed(ids))).json()["data"] == receipt
    assert create(client, headers, ids, wear_date="2020-10-21").status_code == 409
    path = f"/api/v1/wear-records/{receipt['id']}"
    detail = client.get(path, headers=headers).json()["data"]
    assert len(detail["items"]) == 3
    assert all(count(client, headers, garment_id) == 1 for garment_id in ids)
    changed = client.patch(
        path, headers=headers, json={"expected_version": 1, "wear_date": "2020-10-20"}
    )
    assert changed.status_code == 200 and changed.json()["data"]["version"] == 2
    assert create(client, headers, ids).json()["data"] == receipt
    assert (
        client.delete(path, headers=headers, params={"expected_version": 1}).status_code
        == 409
    )
    deleted = client.delete(path, headers=headers, params={"expected_version": 2})
    assert deleted.status_code == 200 and deleted.json()["data"] == {
        "id": receipt["id"],
        "deleted": True,
    }
    assert (
        client.delete(path, headers=headers, params={"expected_version": 2}).json()
        == deleted.json()
    )
    assert create(client, headers, ids).status_code == 409
    assert client.get(path, headers=headers).status_code == 404
    assert all(count(client, headers, garment_id) == 0 for garment_id in ids)
    revision = db_session.get(AccountRevision, owner_id)
    assert revision.history_revision == 3 and revision.inventory_revision == inventory
    assert db_session.scalar(select(func.count()).select_from(WearRecord)) == 0
    assert db_session.scalar(select(func.count()).select_from(WearRecordItem)) == 0
    assert db_session.scalar(select(func.count()).select_from(WearRecordTombstone)) == 1
    assert (
        db_session.query(IdempotencyReceipt)
        .filter_by(operation="wear-record.create")
        .count()
        == 1
    )


def test_snapshot_retention_new_items_and_summary(client, db_session, owner):
    owner_id, headers = owner
    first, removed, added = [garment(client, headers, name=f"旧{i}") for i in range(3)]
    record_id = create(client, headers, [first, removed]).json()["data"]["id"]
    for garment_id in (first, added):
        assert (
            client.patch(
                f"/api/v1/garments/{garment_id}",
                headers=headers,
                json={
                    "expected_version": 1,
                    "name": "新名称",
                    "category": "bottoms",
                    "status": "archived",
                },
            ).status_code
            == 200
        )
    path = f"/api/v1/wear-records/{record_id}"
    changed = client.patch(
        path,
        headers=headers,
        json={
            "expected_version": 1,
            "garment_ids": [first, added],
            "wear_date": "2020-10-21",
        },
    )
    assert changed.status_code == 200
    items = {item["garment_id"]: item for item in changed.json()["data"]["items"]}
    assert (
        items[first]["name_snapshot"] == "旧0"
        and items[first]["category_snapshot"] == "tops"
    )
    assert (
        items[added]["name_snapshot"] == "新名称"
        and items[added]["category_snapshot"] == "bottoms"
    )
    assert count(client, headers, first) == count(client, headers, added) == 1
    assert count(client, headers, removed) == 0
    assert create(client, headers, [first], key="second").status_code == 200
    summary = wear_service(db_session).history_summary(
        owner_id, date(2020, 10, 21), date(2020, 10, 22)
    )
    assert (summary.record_count, summary.timezone) == (2, "Asia/Shanghai")
    counts = {item.garment_id: item for item in summary.garments}
    assert counts[UUID(first)].wear_count == 2 and counts[
        UUID(first)
    ].last_wear_date == date(2020, 10, 22)
    assert counts[UUID(added)].wear_count == 1
    assert (
        wear_service(db_session)
        .history_summary(owner_id, date(2019, 1, 1), date(2019, 12, 31))
        .record_count
        == 0
    )


def test_photo_only_unknown_snapshot_stays_unknown(client, db_session, owner, tmp_path):
    owner_id, headers = owner
    raw = BytesIO()
    Image.new("RGB", (3, 4), "red").save(raw, format="PNG")
    media = MediaService(
        MediaRepository(db_session),
        RevisionRepository(db_session),
        MediaStore(tmp_path),
    ).upload(owner_id, "garment", "picture", raw.getvalue())
    garment_id = test_garments.create(
        client, headers, {"photo_media_id": str(media.id)}
    ).json()["data"]["id"]
    record_id = create(client, headers, [garment_id]).json()["data"]["id"]
    item = client.get(f"/api/v1/wear-records/{record_id}", headers=headers).json()[
        "data"
    ]["items"][0]
    assert item == {
        "garment_id": garment_id,
        "name_snapshot": None,
        "category_snapshot": None,
    }


def test_invalid_inputs_permissions_and_patch_missing_null(client, db_session, owner):
    owner_id, headers = owner
    garment_id = garment(client, headers)
    for wear_date, ids in (
        ("2099-01-01", [garment_id]),
        (TODAY, []),
        (TODAY, [str(uuid4())]),
        ("2020-10-22T00:00:00Z", [garment_id]),
        (0, [garment_id]),
    ):
        assert create(client, headers, ids, wear_date=wear_date).status_code in (
            404,
            422,
        )
    assert db_session.get(AccountRevision, owner_id).history_revision == 0
    record_id = create(client, headers, [garment_id]).json()["data"]["id"]
    path = f"/api/v1/wear-records/{record_id}"
    for extra in (
        {"wear_date": None},
        {"garment_ids": None},
        {"garment_ids": []},
        {"expected_version": True},
    ):
        assert (
            client.patch(
                path, headers=headers, json={"expected_version": 1, **extra}
            ).status_code
            == 422
        )
    assert (
        client.patch(path, headers=headers, json={"expected_version": 1}).json()[
            "data"
        ]["items"][0]["garment_id"]
        == garment_id
    )
    assert (
        client.patch(
            path, headers=headers, json={"expected_version": 1, "wear_date": TODAY}
        ).status_code
        == 409
    )
    other = client.post("/api/v1/auth/wechat", json={"code": "other"}).json()["data"]
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    assert create(client, other_headers, [garment_id]).status_code == 404
    assert client.get(path, headers=other_headers).status_code == 404
    assert (
        client.patch(
            path, headers=other_headers, json={"expected_version": 2}
        ).status_code
        == 404
    )
    assert (
        client.delete(
            path, headers=other_headers, params={"expected_version": 2}
        ).status_code
        == 404
    )
    assert (
        client.get("/api/v1/wear-records", headers=other_headers).json()["data"][
            "items"
        ]
        == []
    )
    assert client.get(path).status_code == 401
    assert client.delete(path, headers=headers).status_code == 422


def test_pagination_filters_and_single_query_list(client, db_session, owner):
    _, headers = owner
    garment_id = garment(client, headers)
    ids = [
        create(client, headers, [garment_id], wear_date=value, key=str(index)).json()[
            "data"
        ]["id"]
        for index, value in enumerate((TODAY, TODAY, "2020-10-21"))
    ]
    first = client.get("/api/v1/wear-records?page_size=1", headers=headers).json()[
        "data"
    ]
    cursor = first["next_cursor"]
    second = client.get(
        "/api/v1/wear-records",
        params={"cursor": cursor, "page_size": 1},
        headers=headers,
    ).json()["data"]
    assert [first["items"][0]["id"], second["items"][0]["id"]] == sorted(
        ids[:2], reverse=True
    )
    assert (
        client.get(
            "/api/v1/wear-records",
            params={"cursor": cursor, "start_date": TODAY},
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        client.get("/api/v1/wear-records?cursor=bad", headers=headers).status_code
        == 422
    )
    assert (
        client.get(
            "/api/v1/wear-records?start_date=2020-10-22&end_date=2020-10-21",
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        client.get("/api/v1/wear-records?start_date=0", headers=headers).status_code
        == 422
    )
    ranged = client.get(
        f"/api/v1/wear-records?start_date={TODAY}&end_date={TODAY}", headers=headers
    ).json()["data"]
    assert len(ranged["items"]) == 2
    statements = []

    def track(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", track)
    try:
        result = wear_service(db_session).list(owner[0], None, None, None, 20)
    finally:
        event.remove(engine, "before_cursor_execute", track)
    assert len(result.items) == 3 and len(statements) == 1


def test_beijing_midnight_clock(client, db_session, owner):
    _, headers = owner
    garment_id = garment(client, headers)
    for clock, expected in (
        (datetime(2020, 10, 21, 15, 59, 59, tzinfo=timezone.utc), 422),
        (datetime(2020, 10, 21, 16, 0, tzinfo=timezone.utc), 200),
    ):

        def configured(db=Depends(get_db)):
            return wear_service(db, clock=lambda: clock)

        app.dependency_overrides[get_wear_service] = configured
        response = create(client, headers, [garment_id])
        assert response.status_code == expected


@pytest.mark.parametrize("failure", ["receipt", "revision"])
def test_history_failure_rolls_back_all_facts(
    client, db_session, owner, monkeypatch, failure
):
    owner_id, headers = owner
    garment_id = garment(client, headers)
    original = (
        IdempotencyRepository.create
        if failure == "receipt"
        else RevisionRepository.increment_history
    )

    def fail(self, *args, **kwargs):
        original(self, *args, **kwargs)
        raise RuntimeError("injected history failure")

    with monkeypatch.context() as scoped:
        scoped.setattr(
            IdempotencyRepository if failure == "receipt" else RevisionRepository,
            "create" if failure == "receipt" else "increment_history",
            fail,
        )
        assert create(client, headers, [garment_id]).status_code == 500
    assert db_session.scalar(select(func.count()).select_from(WearRecord)) == 0
    assert db_session.scalar(select(func.count()).select_from(WearRecordItem)) == 0
    assert db_session.get(AccountRevision, owner_id).history_revision == 0
    assert create(client, headers, [garment_id]).status_code == 200
