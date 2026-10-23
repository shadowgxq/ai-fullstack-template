"""真实 HTTP/ORM 边界的离线检查；行锁和并发另以 PostgreSQL 检查。"""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.api.dependencies import get_wechat_code_exchange
from app.models.account_revision import AccountRevision
from app.models.garment import Garment
from app.models.idempotency_receipt import IdempotencyReceipt
from app.models.media_asset import MediaAsset
from app.repositories.revision_repository import RevisionRepository
from app.services.wechat_service import WechatAccountIdentity
from main import app


class Exchange:
    def exchange(self, code):
        return WechatAccountIdentity("wx-test", code)


@pytest.fixture
def owner(client):
    app.dependency_overrides[get_wechat_code_exchange] = Exchange
    response = client.post("/api/v1/auth/wechat", json={"code": "owner"})
    assert response.status_code == 200
    data = response.json()["data"]
    return data["user"]["id"], {"Authorization": f"Bearer {data['access_token']}"}


def create(client, headers, payload=None, key="create-key"):
    return client.post(
        "/api/v1/garments",
        json=payload if payload is not None else {"name": "白衬衫"},
        headers={**headers, "Idempotency-Key": key},
    )


def test_create_receipt_is_immutable_and_revision_atomic(client, db_session, owner):
    owner_id, headers = owner
    assert db_session.get(AccountRevision, owner_id).inventory_revision == 0
    response = create(
        client,
        headers,
        {
            "name": "  白衬衫  ",
            "season": ["spring", " spring ", ""],
            "tags": ["  喜欢 ", "喜欢"],
        },
    )
    assert response.status_code == 200
    receipt = response.json()["data"]
    garment_id = receipt["id"]
    patch = client.patch(
        f"/api/v1/garments/{garment_id}",
        headers=headers,
        json={"expected_version": 1, "status": "archived", "category": "tops"},
    )
    assert patch.status_code == 200
    view = patch.json()["data"]
    assert (
        view["version"],
        view["status"],
        view["name"],
        view["season"],
        view["tags"],
    ) == (2, "archived", "白衬衫", ["spring"], ["喜欢"])
    assert "owner_id" not in view and "wear_count" not in view
    replay = create(
        client, headers, {"name": "白衬衫", "season": ["spring"], "tags": ["喜欢"]}
    )
    assert replay.status_code == 200 and replay.json()["data"] == receipt
    assert create(client, headers, {"name": "不同内容"}).status_code == 409
    assert db_session.scalar(select(func.count()).select_from(Garment)) == 1
    assert db_session.scalar(select(func.count()).select_from(IdempotencyReceipt)) == 1
    assert db_session.get(AccountRevision, owner_id).inventory_revision == 2


def test_empty_unknown_and_patch_null_semantics(client, db_session, owner):
    owner_id, headers = owner
    for payload in (
        {},
        {"name": " \t\n "},
        {"name": "x", "category": "unknown"},
        {"name": "x", "season": ["unknown"]},
        {"name": "x", "tags": None},
    ):
        assert create(client, headers, payload).status_code == 422
    assert db_session.get(AccountRevision, owner_id).inventory_revision == 0
    garment_id = create(
        client, headers, {"name": "有效", "category": "tops", "tags": ["casual"]}
    ).json()["data"]["id"]
    path = f"/api/v1/garments/{garment_id}"
    assert (
        client.patch(
            path, headers=headers, json={"expected_version": 1, "name": None}
        ).status_code
        == 422
    )
    assert (
        client.patch(
            path, headers=headers, json={"expected_version": 1, "status": None}
        ).status_code
        == 422
    )
    assert (
        client.patch(
            path, headers=headers, json={"expected_version": 1, "tags": None}
        ).status_code
        == 422
    )
    response = client.patch(
        path,
        headers=headers,
        json={"expected_version": 1, "category": None, "tags": []},
    )
    assert response.status_code == 200
    assert (
        response.json()["data"]["category"] is None
        and response.json()["data"]["tags"] == []
    )
    assert response.json()["data"]["name"] == "有效"
    assert (
        client.patch(
            path, headers=headers, json={"expected_version": 1, "name": "过时"}
        ).status_code
        == 409
    )


def test_permissions_photo_validation_and_cursor_binding(client, db_session, owner):
    owner_id, headers = owner
    other = client.post("/api/v1/auth/wechat", json={"code": "other"}).json()["data"]
    other_headers = {"Authorization": f"Bearer {other['access_token']}"}
    for purpose, status in (
        ("avatar", "ready"),
        ("garment", "pending"),
        ("garment", "ready"),
    ):
        asset = MediaAsset(
            owner_id=owner_id,
            purpose=purpose,
            status=status,
            idempotency_key=str(uuid4()),
            original_sha256="a" * 64,
            normalized_sha256="b" * 64,
            storage_key=str(uuid4()),
            content_type="image/png",
            size_bytes=1,
            width=1,
            height=1,
        )
        db_session.add(asset)
        db_session.commit()
        assert (
            create(client, other_headers, {"photo_media_id": str(asset.id)}).status_code
            == 404
        )
        response = create(
            client, headers, {"photo_media_id": str(asset.id)}, key=str(asset.id)
        )
        assert response.status_code == (
            200 if purpose == "garment" and status == "ready" else 422
        )
    garment_id = create(
        client,
        headers,
        {"name": "x", "season": ["spring"], "occasion": ["work"], "tags": ["特别"]},
        key="second",
    ).json()["data"]["id"]
    path = f"/api/v1/garments/{garment_id}"
    assert client.get(path, headers=other_headers).status_code == 404
    assert (
        client.patch(
            path, headers=other_headers, json={"expected_version": 1, "name": "hijack"}
        ).status_code
        == 404
    )
    db_session.query(Garment).update(
        {"created_at": datetime(2026, 1, 1, tzinfo=timezone.utc)}
    )
    db_session.commit()
    first = client.get("/api/v1/garments?page_size=1", headers=headers).json()["data"]
    cursor = first["next_cursor"]
    assert cursor
    second = client.get(
        "/api/v1/garments", params={"cursor": cursor, "page_size": 1}, headers=headers
    ).json()["data"]
    assert first["items"][0]["id"] != second["items"][0]["id"]
    assert first["items"][0]["id"] > second["items"][0]["id"]
    for params, authorization in (
        ({"cursor": cursor, "status": "archived"}, headers),
        ({"cursor": cursor}, other_headers),
        ({"cursor": "garbage"}, headers),
    ):
        assert (
            client.get(
                "/api/v1/garments", params=params, headers=authorization
            ).status_code
            == 422
        )
    result = client.get(
        "/api/v1/garments?season=spring&occasion=work&tag=特别", headers=headers
    ).json()["data"]["items"]
    assert [item["id"] for item in result] == [garment_id]
    assert client.get("/api/v1/garments").status_code == 401


def test_revision_failure_rolls_back_garment_and_receipt(
    client, db_session, owner, monkeypatch
):
    owner_id, headers = owner

    def fail(self, revision):
        raise RuntimeError("injected revision failure")

    with monkeypatch.context() as scoped:
        scoped.setattr(RevisionRepository, "increment_inventory", fail)
        response = create(client, headers)
        assert response.status_code == 500
        assert "injected revision failure" not in response.text
    assert db_session.scalar(select(func.count()).select_from(Garment)) == 0
    assert db_session.scalar(select(func.count()).select_from(IdempotencyReceipt)) == 0
    assert db_session.get(AccountRevision, owner_id).inventory_revision == 0
    assert create(client, headers).status_code == 200


def test_catalog_and_idempotency_key_boundary(client, owner):
    _, headers = owner
    options = client.get("/api/v1/wardrobe/options", headers=headers)
    assert options.status_code == 200
    assert all(
        options.json()["data"][field]
        for field in ("categories", "colors", "seasons", "occasions", "styles")
    )
    assert (
        client.post("/api/v1/garments", json={"name": "x"}, headers=headers).status_code
        == 422
    )
    assert create(client, headers, key=" ").status_code == 422
