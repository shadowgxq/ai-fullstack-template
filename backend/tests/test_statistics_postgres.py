"""显式隔离 PostgreSQL/Redis 的统计授权、窗口及 statement 快照证据。"""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
import json
import os
from pathlib import Path
from threading import Event
import time
from uuid import uuid4

from fastapi import Depends
from fastapi.testclient import TestClient
import pytest
from redis import Redis
from sqlalchemy import event, text
from sqlalchemy.orm import Session

from app.api.dependencies import get_statistics_service, get_wechat_code_exchange
from app.core import redis_client as redis_module
from app.core.exceptions import BusinessException
from app.core.session import get_db
from app.repositories.statistics_repository import StatisticsRepository
from app.schemas.garment import GarmentCreate, GarmentPatch
from app.schemas.wear import WearCreate
from app.services import auth_redis_service, cache_service
from app.services.statistics_service import StatisticsService
from app.services.wechat_service import WechatAccountIdentity
from main import app
import test_garment_postgres
import test_wechat_postgres
import test_wear_postgres

postgres_database = test_wechat_postgres.postgres_database
NOW = datetime(2024, 3, 1, 4, tzinfo=timezone.utc)


def test_statistics_http_write_refresh_and_private_access(
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
    prefix = f"statistics-api-test-{uuid4().hex}:"
    monkeypatch.setattr(auth_redis_service, "TOKEN_BLACKLIST_PREFIX", prefix + "jwt:")
    monkeypatch.setattr(cache_service, "USER_CACHE_PREFIX", prefix + "user:")
    for module in (redis_module, auth_redis_service, cache_service):
        monkeypatch.setattr(module, "redis_client", redis)

    class Exchange:
        def exchange(self, code):
            return WechatAccountIdentity("wx-statistics-test", code)

    def database_session():
        with Session(engine) as db:
            yield db

    def statistics(db=Depends(get_db)):
        return StatisticsService(
            StatisticsRepository(db), "statistics-api-test", lambda: NOW
        )

    app.dependency_overrides[get_db] = database_session
    app.dependency_overrides[get_wechat_code_exchange] = Exchange
    app.dependency_overrides[get_statistics_service] = statistics
    captured = {}

    def data(response):
        assert response.status_code == 200, response.text
        return response.json()["data"]

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
            captured["empty"] = data(client.get("/api/v1/statistics", headers=own))
            assert (
                captured["empty"]["wardrobe_total"]
                == captured["empty"]["wear_record_count"]
                == 0
            )
            ids = [
                data(
                    client.post(
                        "/api/v1/garments",
                        headers={**own, "Idempotency-Key": f"garment-{index}"},
                        json=payload,
                    )
                )["id"]
                for index, payload in enumerate(
                    (
                        {"name": "上装", "category": "tops"},
                        {"name": "未分类"},
                        {"name": "暂不可穿", "category": "tops"},
                    )
                )
            ]
            data(
                client.patch(
                    f"/api/v1/garments/{ids[2]}",
                    headers=own,
                    json={"expected_version": 1, "status": "unavailable"},
                )
            )
            captured["inventory"] = data(client.get("/api/v1/statistics", headers=own))
            assert captured["inventory"]["wardrobe_total"] == 3
            receipts = []
            for index, (day, garments) in enumerate(
                (
                    ("2024-01-31", [ids[0]]),
                    ("2024-02-01", [ids[0], ids[0]]),
                    ("2024-03-01", [ids[1], ids[2]]),
                )
            ):
                receipts.append(
                    data(
                        client.post(
                            "/api/v1/wear-records",
                            headers={**own, "Idempotency-Key": f"wear-{index}"},
                            json={"wear_date": day, "garment_ids": garments},
                        )
                    )
                )
            created = captured["created"] = data(
                client.get("/api/v1/statistics", headers=own)
            )
            assert (
                created["wear_record_count"] == 3
                and sum(day["count"] for day in created["trend"]["days"]) == 2
            )
            first = captured["first_page"] = data(
                client.get("/api/v1/statistics?page_size=1", headers=own)
            )
            cursor = first["garment_counts"]["next_cursor"]
            second = captured["second_page"] = data(
                client.get(
                    "/api/v1/statistics",
                    headers=own,
                    params={"garment_cursor": cursor, "page_size": 1},
                )
            )
            assert (
                first["garment_counts"]["items"][0]["garment_id"]
                != second["garment_counts"]["items"][0]["garment_id"]
            )
            assert (
                client.get(
                    "/api/v1/statistics",
                    headers=other,
                    params={"garment_cursor": cursor},
                ).status_code
                == 422
            )
            assert (
                data(client.get("/api/v1/statistics", headers=other))["wardrobe_total"]
                == 0
            )
            record_id = receipts[2]["id"]
            data(
                client.patch(
                    f"/api/v1/wear-records/{record_id}",
                    headers=own,
                    json={
                        "expected_version": 1,
                        "wear_date": "2024-02-29",
                        "garment_ids": [ids[0]],
                    },
                )
            )
            assert (
                client.get(
                    "/api/v1/statistics", headers=own, params={"garment_cursor": cursor}
                ).status_code
                == 409
            )
            patched = captured["patched"] = data(
                client.get("/api/v1/statistics", headers=own)
            )
            assert {
                item["garment_id"]: item["wear_count"]
                for item in patched["garment_counts"]["items"]
            } == {ids[0]: 3, ids[1]: 0, ids[2]: 0}
            data(
                client.patch(
                    f"/api/v1/garments/{ids[0]}",
                    headers=own,
                    json={"expected_version": 1, "status": "archived"},
                )
            )
            archived = captured["archived"] = data(
                client.get("/api/v1/statistics", headers=own)
            )
            assert (
                archived["wardrobe_total"],
                archived["archived_count"],
                archived["wear_record_count"],
            ) == (2, 1, 3)
            assert {
                item["category"]: item["count"] for item in archived["category_counts"]
            } == {None: 1, "tops": 1}
            data(
                client.delete(
                    f"/api/v1/wear-records/{record_id}",
                    headers=own,
                    params={"expected_version": 2},
                )
            )
            deleted = captured["deleted"] = data(
                client.get("/api/v1/statistics", headers=own)
            )
            assert deleted["wear_record_count"] == 2
            assert deleted["garment_counts"]["items"][0]["wear_count"] == 2
            assert sum(day["count"] for day in deleted["trend"]["days"]) == 1
            assert client.get("/api/v1/statistics").status_code == 401
            data(client.post("/api/v1/auth/logout", headers=own))
            assert client.get("/api/v1/statistics", headers=own).status_code == 401
        # 只保存本 fixture 创建的业务 data，不含 code、token 或认证头。
        output = (
            Path(__file__).resolve().parents[2]
            / ".tools/manager-runtime/statistics-consumer-responses.json"
        )
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(captured, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    finally:
        for dependency in (get_db, get_wechat_code_exchange, get_statistics_service):
            app.dependency_overrides.pop(dependency, None)
        keys = list(redis.scan_iter(match=prefix + "*"))
        if keys:
            redis.delete(*keys)
        redis.close()


def test_real_statement_snapshot_stays_consistent_during_committed_writes(
    postgres_database,
):
    engine, owner_id, first = test_wear_postgres.setup_inventory(postgres_database)
    with Session(engine) as db:
        test_garment_postgres.garments(db).create(
            owner_id, GarmentCreate(name="第二件"), "second"
        )
    lock_key = int(uuid4().hex[:14], 16)
    reader_started = Event()
    reader_pid = []
    statement_count = []
    with engine.connect() as gate:
        gate.execute(text("SELECT pg_advisory_lock(:key)"), {"key": lock_key})

        def read():
            with engine.connect() as connection:
                reader_pid.append(connection.scalar(text("SELECT pg_backend_pid()")))

                def pause_statement(
                    conn, cursor, statement, parameters, context, executemany
                ):
                    assert (
                        "owned_garments" in statement and "owned_records" in statement
                    )
                    statement_count.append(statement)
                    reader_started.set()
                    # 仅测试调度外加门闩：原统计 SELECT 保持不变，服务器在
                    # 已取得 statement snapshot 后等待，另一连接可提交真实写入。
                    return (
                        f"WITH statistics_gate AS MATERIALIZED (SELECT pg_advisory_xact_lock({lock_key})) SELECT statistics_rows.* FROM statistics_gate CROSS JOIN ({statement}) AS statistics_rows",
                        parameters,
                    )

                event.listen(
                    connection, "before_cursor_execute", pause_statement, retval=True
                )
                try:
                    with Session(bind=connection) as db:
                        return StatisticsService(
                            StatisticsRepository(db), "snapshot-test", lambda: NOW
                        ).get(owner_id, page_size=1)
                finally:
                    event.remove(connection, "before_cursor_execute", pause_statement)

        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(read)
            try:
                assert reader_started.wait(timeout=10)
                deadline = time.monotonic() + 5
                while not gate.scalar(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid=:pid AND locktype=:kind AND NOT granted)"
                    ),
                    {"pid": reader_pid[0], "kind": "advisory"},
                ):
                    assert time.monotonic() < deadline
                    time.sleep(0.01)
                with Session(engine) as db:
                    test_garment_postgres.garments(db).patch(
                        owner_id,
                        first,
                        GarmentPatch(expected_version=1, status="archived"),
                    )
                    test_wear_postgres.history(db).create(
                        owner_id,
                        WearCreate(wear_date=date(2024, 3, 1), garment_ids=[first]),
                        "wear",
                    )
                gate.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": lock_key})
                old = future.result(timeout=10)
            finally:
                gate.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": lock_key})
    assert len(statement_count) == 1
    assert (old.wardrobe_total, old.archived_count, old.wear_record_count) == (2, 0, 0)
    assert sum(item.count for item in old.category_counts) == 2
    assert sum(item.count for item in old.trend.days) == 0
    assert old.garment_counts.items[0].wear_count == 0
    with Session(engine) as db:
        service = StatisticsService(
            StatisticsRepository(db), "snapshot-test", lambda: NOW
        )
        with pytest.raises(BusinessException) as error:
            service.get(owner_id, old.garment_counts.next_cursor)
        assert error.value.status_code == 409
        current = service.get(owner_id)
        assert (
            current.wardrobe_total,
            current.archived_count,
            current.wear_record_count,
        ) == (1, 1, 1)
        assert (
            current.garment_counts.items[0].garment_id == first
            and current.garment_counts.items[0].wear_count == 1
        )


def test_postgres_midnight_leap_window_and_cursor(postgres_database):
    engine, owner_id, first = test_wear_postgres.setup_inventory(postgres_database)
    with Session(engine) as db:
        test_garment_postgres.garments(db).create(
            owner_id, GarmentCreate(name="第二件"), "second"
        )
        for index, day in enumerate(
            (date(2024, 1, 31), date(2024, 2, 1), date(2024, 2, 29), date(2024, 3, 1))
        ):
            test_wear_postgres.history(db).create(
                owner_id, WearCreate(wear_date=day, garment_ids=[first]), str(index)
            )
        clock = [datetime(2024, 3, 1, 15, 59, 59, tzinfo=timezone.utc)]
        service = StatisticsService(
            StatisticsRepository(db), "date-test", lambda: clock[0]
        )
        initial = service.get(owner_id, page_size=1)
        assert (
            initial.wear_record_count == 4
            and sum(item.count for item in initial.trend.days) == 3
        )
        assert initial.trend.start_date == date(2024, 2, 1)
        clock[0] += timedelta(seconds=1)
        with pytest.raises(BusinessException) as error:
            service.get(owner_id, initial.garment_counts.next_cursor)
        assert error.value.status_code == 409
        after = service.get(owner_id)
        assert (after.trend.start_date, after.trend.end_date) == (
            date(2024, 2, 2),
            date(2024, 3, 2),
        )
        assert (
            sum(item.count for item in after.trend.days) == 2
            and after.wear_record_count == 4
        )
