"""在显式隔离 PG/Redis 上验证衣物到穿着事实的真实 HTTP 消费链。"""

import json
import os
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from redis import Redis
from sqlalchemy.orm import Session

from app.api.dependencies import get_wechat_code_exchange
from app.core import redis_client as redis_module
from app.core.session import get_db
from app.models.account_revision import AccountRevision
from app.services import auth_redis_service, cache_service
from app.services.wechat_service import WechatAccountIdentity
from main import app
import test_wechat_postgres

postgres_database = test_wechat_postgres.postgres_database


def test_wear_http_chain_preserves_facts_and_authorization(
    postgres_database, monkeypatch
):
    redis_url = os.environ.get("WARDROBE_TEST_REDIS_URL")
    if not redis_url:
        pytest.skip(
            "WARDROBE_TEST_REDIS_URL must explicitly select isolated Redis db14"
        )
    if redis_url != "redis://127.0.0.1:56379/14":
        pytest.fail("Redis URL is outside the authorized wardrobe-manager test db14")
    engine, migrate = postgres_database
    migrate("head")
    redis = Redis.from_url(
        redis_url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2
    )
    assert redis.ping()
    prefix = f"wear-api-test-{uuid4().hex}:"
    monkeypatch.setattr(auth_redis_service, "TOKEN_BLACKLIST_PREFIX", prefix + "jwt:")
    monkeypatch.setattr(cache_service, "USER_CACHE_PREFIX", prefix + "user:")
    for module in (redis_module, auth_redis_service, cache_service):
        monkeypatch.setattr(module, "redis_client", redis)

    class Exchange:
        def exchange(self, code):
            return WechatAccountIdentity("wx-wear-api-test", code)

    def database_session():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = database_session
    app.dependency_overrides[get_wechat_code_exchange] = Exchange
    captured = {}

    def data(response, status=200):
        assert response.status_code == status, response.text
        body = response.json()
        assert body["code"] == 0
        return body["data"]

    try:
        with TestClient(app) as client:
            sessions = [
                data(client.post("/api/v1/auth/wechat", json={"code": code}))
                for code in ("owner", "other")
            ]
            own, other = [
                {"Authorization": "Bearer " + session["access_token"]}
                for session in sessions
            ]
            first = data(
                client.post(
                    "/api/v1/garments",
                    headers={**own, "Idempotency-Key": "garment-one"},
                    json={"name": "保存时名称", "category": "tops"},
                )
            )["id"]
            second = data(
                client.post(
                    "/api/v1/garments",
                    headers={**own, "Idempotency-Key": "garment-two"},
                    json={"name": "未知类别衣物"},
                )
            )["id"]
            data(
                client.patch(
                    f"/api/v1/garments/{second}",
                    headers=own,
                    json={"expected_version": 1, "status": "archived"},
                )
            )
            payload = {"wear_date": "2020-10-22", "garment_ids": [first, second, first]}
            create_headers = {**own, "Idempotency-Key": "actual-wear"}
            receipt = captured["created"] = data(
                client.post(
                    "/api/v1/wear-records", headers=create_headers, json=payload
                )
            )
            assert (
                data(
                    client.post(
                        "/api/v1/wear-records", headers=create_headers, json=payload
                    )
                )
                == receipt
            )
            record_path = f"/api/v1/wear-records/{receipt['id']}"
            detail = captured["detail"] = data(client.get(record_path, headers=own))
            snapshots = {item["garment_id"]: item for item in detail["items"]}
            assert len(snapshots) == 2
            assert snapshots[first]["name_snapshot"] == "保存时名称"
            assert snapshots[second]["category_snapshot"] is None
            captured["list"] = data(client.get("/api/v1/wear-records", headers=own))
            assert len(captured["list"]["items"]) == 1
            assert captured["list"]["next_cursor"] is None
            for garment_id in (first, second):
                value = data(client.get(f"/api/v1/garments/{garment_id}", headers=own))
                assert value["wear_count"] == 1
            captured["garment_before"] = value
            data(
                client.patch(
                    f"/api/v1/garments/{first}",
                    headers=own,
                    json={
                        "expected_version": 1,
                        "name": "当前名称",
                        "category": "bottoms",
                    },
                )
            )
            changed = captured["patched"] = data(
                client.patch(
                    record_path,
                    headers=own,
                    json={
                        "expected_version": 1,
                        "wear_date": "2020-10-20",
                        "garment_ids": [first],
                    },
                )
            )
            assert changed["version"] == 2
            assert changed["items"] == [snapshots[first]]
            assert (
                data(client.get(f"/api/v1/garments/{second}", headers=own))[
                    "wear_count"
                ]
                == 0
            )
            assert (
                data(client.get(f"/api/v1/garments/{first}", headers=own))["wear_count"]
                == 1
            )
            for method, kwargs in (
                (client.get, {}),
                (
                    client.patch,
                    {"json": {"expected_version": 2, "wear_date": "2020-10-19"}},
                ),
                (client.delete, {"params": {"expected_version": 2}}),
            ):
                assert method(record_path, headers=other, **kwargs).status_code == 404
            assert client.get(record_path).status_code == 401
            assert (
                data(client.get("/api/v1/wear-records", headers=other))["items"] == []
            )
            assert (
                client.post(
                    "/api/v1/wear-records",
                    headers={**other, "Idempotency-Key": "cross-owner"},
                    json=payload,
                ).status_code
                == 404
            )
            assert (
                data(
                    client.post(
                        "/api/v1/wear-records", headers=create_headers, json=payload
                    )
                )
                == receipt
            )
            assert (
                client.delete(
                    record_path, headers=own, params={"expected_version": 1}
                ).status_code
                == 409
            )
            captured["deleted"] = data(
                client.delete(record_path, headers=own, params={"expected_version": 2})
            )
            assert (
                data(
                    client.delete(
                        record_path, headers=own, params={"expected_version": 2}
                    )
                )
                == captured["deleted"]
            )
            assert (
                client.post(
                    "/api/v1/wear-records", headers=create_headers, json=payload
                ).status_code
                == 409
            )
            assert client.get(record_path, headers=own).status_code == 404
            captured["empty_list"] = data(
                client.get("/api/v1/wear-records", headers=own)
            )
            assert captured["empty_list"]["items"] == []
            captured["garment_after"] = data(
                client.get(f"/api/v1/garments/{first}", headers=own)
            )
            assert captured["garment_after"]["wear_count"] == 0
            assert captured["garment_after"]["name"] == "当前名称"
            with Session(engine) as db:
                revision = db.get(AccountRevision, sessions[0]["user"]["id"])
                assert (revision.inventory_revision, revision.history_revision) == (
                    4,
                    3,
                )
                assert (
                    db.get(AccountRevision, sessions[1]["user"]["id"]).history_revision
                    == 0
                )
            assert client.post("/api/v1/auth/logout", headers=own).status_code == 200
            assert client.get("/api/v1/wear-records", headers=own).status_code == 401
            assert client.get("/api/v1/wear-records", headers=other).status_code == 200
        # 显式导出仅用于直接 decoder 联检，白名单数据不含会话凭据。
        output = os.environ.get("WARDROBE_CONSUMER_RESPONSES")
        if output:
            target = Path(output).resolve()
            expected = (
                Path(__file__).resolve().parents[2]
                / ".tools/manager-runtime/wear-consumer-responses.json"
            )
            assert target == expected.resolve()
            target.write_text(
                json.dumps(captured, ensure_ascii=False), encoding="utf-8"
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_wechat_code_exchange, None)
        keys = list(redis.scan_iter(match=prefix + "*"))
        if keys:
            redis.delete(*keys)
        redis.close()
