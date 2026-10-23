"""只在本任务专用 PG UUID schema / Redis db14 验证偏好与修订。"""

from concurrent.futures import ThreadPoolExecutor
from datetime import date
import json
import os
from pathlib import Path
import subprocess
import sys
from threading import Barrier
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from redis import Redis
from sqlalchemy import event, func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_wechat_code_exchange
from app.core import redis_client as redis_module
from app.core.exceptions import BusinessException
from app.core.session import get_db, transaction
from app.models.account_revision import AccountRevision
from app.models.garment import Garment
from app.models.user_profile import UserProfile
from app.models.wardrobe_preferences import WardrobePreferences
from app.models.wear_record import WearRecord, WearRecordItem
from app.schemas.preferences import PreferencesPut
from app.services import auth_redis_service, cache_service
from app.services.wechat_service import WechatAccountIdentity
from main import app
from test_preferences import empty_payload, preferences_service
import test_garment_postgres
import test_wechat_postgres

postgres_database = test_wechat_postgres.postgres_database
OLD_HEAD = "5dbf2ea7379b"


def test_migration_retains_old_facts_and_backfills_only_revision(postgres_database):
    engine, migrate = postgres_database
    migrate(OLD_HEAD)
    avatar = uuid4()
    with engine.begin() as connection:
        owner = connection.scalar(
            text(
                "INSERT INTO users(username) VALUES ('preferences-legacy') RETURNING id"
            )
        )
        connection.execute(
            text(
                "INSERT INTO user_profiles(user_id,nickname,avatar_media_id,city_id,version) VALUES (:owner,'原昵称',:avatar,'legacy-city',4)"
            ),
            {"owner": owner, "avatar": avatar},
        )
        connection.execute(
            text(
                "INSERT INTO account_revisions(owner_id,inventory_revision,history_revision) VALUES (:owner,7,9)"
            ),
            {"owner": owner},
        )
    with Session(engine) as db, transaction(db):
        garment = Garment(owner_id=owner, name="原衣物")
        db.add(garment)
        db.flush()
        garment_id, record_id = garment.id, uuid4()
        # This fixture runs at OLD_HEAD, before the optional recommendation
        # source column. Prepare only columns belonging to that old schema.
        db.execute(
            text(
                "INSERT INTO wear_records(id,owner_id,wear_date,version,created_at,updated_at) VALUES (:id,:owner,'2020-01-01',1,now(),now())"
            ),
            {"id": record_id, "owner": owner},
        )
        db.add(
            WearRecordItem(
                record_id=record_id,
                garment_id=garment_id,
                name_snapshot="原快照",
                category_snapshot="tops",
            )
        )
    migrate("head")
    with Session(engine) as db:
        row = db.get(UserProfile, owner)
        assert (row.nickname, row.avatar_media_id, row.city_id, row.version) == (
            "原昵称",
            avatar,
            "legacy-city",
            4,
        )
        assert db.get(Garment, garment_id).name == "原衣物"
        assert db.get(WearRecord, record_id).wear_date == date(2020, 1, 1)
        assert db.get(WearRecordItem, (record_id, garment_id)).name_snapshot == "原快照"
        revision = db.get(AccountRevision, owner)
        assert (
            revision.inventory_revision,
            revision.history_revision,
            revision.preferences_revision,
        ) == (7, 9, 0)
        assert preferences_service(db).get(owner).version == 0
        assert db.scalar(select(func.count()).select_from(WardrobePreferences)) == 0
    assert "ck_preferences_revision_nonnegative" in {
        c["name"] for c in inspect(engine).get_check_constraints("account_revisions")
    }
    assert "ck_preferences_version_positive" in {
        c["name"] for c in inspect(engine).get_check_constraints("wardrobe_preferences")
    }
    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE account_revisions SET preferences_revision=-1 WHERE owner_id=:owner"
                ),
                {"owner": owner},
            )
    with Session(engine) as db:
        with pytest.raises(IntegrityError):
            with transaction(db):
                db.add(WardrobePreferences(owner_id=owner, version=0))
                db.flush()
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "check"],
        cwd=Path(__file__).resolve().parents[1],
        env=dict(
            os.environ, DATABASE_URL=engine.url.render_as_string(hide_password=False)
        ),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert "No new upgrade operations" in result.stdout


@pytest.mark.parametrize("existing", [False, True])
def test_initial_and_existing_same_version_saves_serialize(postgres_database, existing):
    engine, migrate = postgres_database
    migrate("head")
    owner = test_garment_postgres.create_owner(engine)
    if existing:
        with Session(engine) as db:
            preferences_service(db).put(
                owner,
                PreferencesPut.model_validate(
                    {**empty_payload(), "liked_colors": ["blue"]}
                ),
            )
    barrier = Barrier(2)

    def save(color):
        with Session(engine) as db:
            service = preferences_service(db)
            assert service.get(owner).version == int(existing)
            barrier.wait(timeout=10)
            try:
                return service.put(
                    owner,
                    PreferencesPut.model_validate(
                        {**empty_payload(int(existing)), "liked_colors": [color]}
                    ),
                )
            except BusinessException as error:
                return error

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(save, ["white", "black"]))
    successes = [r for r in results if not isinstance(r, BusinessException)]
    failures = [r for r in results if isinstance(r, BusinessException)]
    assert len(successes) == len(failures) == 1
    assert failures[0].code == 40960
    with Session(engine) as db:
        assert preferences_service(db).get(owner) == successes[0]
        assert successes[0].version == int(existing) + 1
        assert db.scalar(select(func.count()).select_from(WardrobePreferences)) == 1
        revision = db.get(AccountRevision, owner)
        assert (
            revision.inventory_revision,
            revision.history_revision,
            revision.preferences_revision,
        ) == (0, 0, int(existing) + 1)
        assert db.get(UserProfile, owner).version == 1


@pytest.mark.parametrize("existing", [False, True])
def test_pg_failed_commit_rolls_back_row_and_revision(postgres_database, existing):
    engine, migrate = postgres_database
    migrate("head")
    owner = test_garment_postgres.create_owner(engine)
    with Session(engine) as db:
        service = preferences_service(db)
        if existing:
            service.put(
                owner,
                PreferencesPut.model_validate(
                    {**empty_payload(), "liked_colors": ["white"]}
                ),
            )
        original = service.get(owner)

        def fail_commit(session):
            raise RuntimeError("injected preferences commit failure")

        event.listen(db, "before_commit", fail_commit)
        try:
            with pytest.raises(RuntimeError, match="preferences commit"):
                service.put(
                    owner,
                    PreferencesPut.model_validate(
                        {**empty_payload(int(existing)), "liked_colors": ["black"]}
                    ),
                )
        finally:
            event.remove(db, "before_commit", fail_commit)
    with Session(engine) as db:
        assert preferences_service(db).get(owner) == original
        assert (db.get(WardrobePreferences, owner) is not None) == existing
        revision = db.get(AccountRevision, owner)
        assert (
            revision.inventory_revision,
            revision.history_revision,
            revision.preferences_revision,
        ) == (0, 0, int(existing))


def test_real_http_auth_preferences_save_clear_and_owner_isolation(
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
    prefix = f"preferences-api-test-{uuid4().hex}:"
    monkeypatch.setattr(auth_redis_service, "TOKEN_BLACKLIST_PREFIX", prefix + "jwt:")
    monkeypatch.setattr(cache_service, "USER_CACHE_PREFIX", prefix + "user:")
    for module in (redis_module, auth_redis_service, cache_service):
        monkeypatch.setattr(module, "redis_client", redis)

    class Exchange:
        def exchange(self, code):
            return WechatAccountIdentity("wx-preferences-api-test", code)

    def database_session():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = database_session
    app.dependency_overrides[get_wechat_code_exchange] = Exchange
    captured = {}

    def data(response):
        assert response.status_code == 200, response.text
        assert response.json()["code"] == 0
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
            owner_id, other_id = [session["user"]["id"] for session in sessions]
            profile_before = data(client.get("/api/v1/profile", headers=own))
            catalog = data(client.get("/api/v1/wardrobe/options", headers=own))
            empty = captured["empty"] = data(
                client.get("/api/v1/preferences", headers=own)
            )
            assert empty == {
                k: v
                for k, v in {
                    **empty_payload(),
                    "version": 0,
                    "catalog_version": catalog["version"],
                }.items()
                if k != "expected_version"
            }
            with Session(engine) as db:
                assert (
                    db.scalar(select(func.count()).select_from(WardrobePreferences))
                    == 0
                )
                assert db.get(AccountRevision, owner_id).preferences_revision == 0
            garment = data(
                client.post(
                    "/api/v1/garments",
                    headers={**own, "Idempotency-Key": "unchanged-garment"},
                    json={"name": "保留衣物"},
                )
            )
            record = data(
                client.post(
                    "/api/v1/wear-records",
                    headers={**own, "Idempotency-Key": "unchanged-history"},
                    json={"wear_date": "2020-01-01", "garment_ids": [garment["id"]]},
                )
            )
            assert client.get("/api/v1/preferences").status_code == 401
            assert (
                client.put("/api/v1/preferences", json=empty_payload()).status_code
                == 401
            )
            for field in ("owner_id", "scene", "preferences_revision"):
                assert (
                    client.put(
                        "/api/v1/preferences",
                        headers=own,
                        json={**empty_payload(), field: other_id},
                    ).status_code
                    == 422
                )
            for version in (True, "0", -1, None):
                assert (
                    client.put(
                        "/api/v1/preferences", headers=own, json=empty_payload(version)
                    ).status_code
                    == 422
                )
            for group, option in [
                ("styles", "minimal"),
                ("colors", "white"),
                ("occasions", "work"),
            ]:
                bad = client.put(
                    "/api/v1/preferences",
                    headers=own,
                    json={
                        **empty_payload(),
                        f"liked_{group}": [option],
                        f"avoided_{group}": [option],
                    },
                )
                assert bad.status_code == 422
                assert ["body", f"avoided_{group}"] in [
                    error["loc"] for error in bad.json()["data"]
                ]
                assert all(
                    set(error) == {"loc", "type", "msg"} for error in bad.json()["data"]
                )
            assert (
                client.put(
                    "/api/v1/preferences",
                    headers=own,
                    json={**empty_payload(), "liked_styles": ["unknown"]},
                ).status_code
                == 422
            )
            assert (
                client.put(
                    "/api/v1/preferences",
                    headers=own,
                    json={**empty_payload(), "liked_colors": ["white"] * 33},
                ).status_code
                == 422
            )
            assert (
                client.put(
                    "/api/v1/preferences", headers=own, json={"expected_version": 0}
                ).status_code
                == 422
            )
            assert data(client.get("/api/v1/preferences", headers=own)) == empty
            payload = {
                **empty_payload(),
                "liked_styles": ["minimal", "casual", "minimal"],
                "avoided_styles": ["sporty"],
                "liked_colors": ["white", "blue"],
                "avoided_colors": ["red"],
                "liked_occasions": ["work"],
                "avoided_occasions": ["sport"],
                "comfort_notes": "  测试偏好原文  ",
            }
            saved = captured["saved"] = data(
                client.put("/api/v1/preferences", headers=own, json=payload)
            )
            assert saved == {
                **empty,
                "liked_styles": ["casual", "minimal"],
                "avoided_styles": ["sporty"],
                "liked_colors": ["blue", "white"],
                "avoided_colors": ["red"],
                "liked_occasions": ["work"],
                "avoided_occasions": ["sport"],
                "comfort_notes": "测试偏好原文",
                "version": 1,
            }
            captured["reread"] = data(client.get("/api/v1/preferences", headers=own))
            assert captured["reread"] == saved
            assert data(client.get("/api/v1/preferences", headers=other)) == empty
            assert (
                client.put("/api/v1/preferences", headers=own, json=payload).status_code
                == 409
            )
            assert data(client.get("/api/v1/preferences", headers=own)) == saved
            cleared = captured["cleared"] = data(
                client.put(
                    "/api/v1/preferences",
                    headers=own,
                    json={**empty_payload(1), "comfort_notes": " \t\n"},
                )
            )
            assert cleared == {**empty, "version": 2}
            assert data(client.get("/api/v1/preferences", headers=own)) == cleared
            assert data(client.get("/api/v1/profile", headers=own)) == profile_before
            assert (
                data(client.get(f"/api/v1/garments/{garment['id']}", headers=own))[
                    "wear_count"
                ]
                == 1
            )
            assert (
                data(client.get(f"/api/v1/wear-records/{record['id']}", headers=own))[
                    "items"
                ][0]["name_snapshot"]
                == "保留衣物"
            )
            with Session(engine) as db:
                revision = db.get(AccountRevision, owner_id)
                assert (
                    revision.inventory_revision,
                    revision.history_revision,
                    revision.preferences_revision,
                ) == (1, 1, 2)
                assert db.get(AccountRevision, other_id).preferences_revision == 0
                assert db.get(WardrobePreferences, other_id) is None
            data(client.post("/api/v1/auth/logout", headers=own))
            assert client.get("/api/v1/preferences", headers=own).status_code == 401
            assert (
                client.put(
                    "/api/v1/preferences", headers=own, json=empty_payload(2)
                ).status_code
                == 401
            )
            assert data(client.get("/api/v1/preferences", headers=other)) == empty
        output = os.environ.get("WARDROBE_PREFERENCES_CONSUMER_RESPONSES")
        if output:
            target = Path(output).resolve()
            expected = (
                Path(__file__).resolve().parents[2]
                / ".tools/manager-runtime/preferences-consumer-responses.json"
            )
            assert target == expected.resolve()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(
                json.dumps(captured, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
    finally:
        for dependency in (get_db, get_wechat_code_exchange):
            app.dependency_overrides.pop(dependency, None)
        keys = list(redis.scan_iter(match=prefix + "*"))
        if keys:
            redis.delete(*keys)
        redis.close()
