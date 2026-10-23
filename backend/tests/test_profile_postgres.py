"""本任务 UUID schema、临时媒体和显式 Redis db14 的资料契约验证。"""

from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import sys
from threading import Barrier, Event
from uuid import uuid4

from fastapi import Depends
from fastapi.testclient import TestClient
from PIL import Image
import pytest
from redis import Redis
from sqlalchemy import event, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_media_service, get_wechat_code_exchange
from app.core import redis_client as redis_module
from app.core.exceptions import BusinessException
from app.core.session import get_db, transaction
from app.models.account_revision import AccountRevision
from app.models.media_asset import MediaAsset
from app.models.user import User
from app.models.user_profile import UserProfile
from app.repositories.media_repository import MediaRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.region_repository import RegionRepository
from app.repositories.revision_repository import RevisionRepository
from app.schemas.profile import ProfilePatch
from app.services import auth_redis_service, cache_service
from app.services.media_service import MediaService
from app.services.media_store import MediaStore
from app.services.profile_service import ProfileService
from app.services.wechat_service import WechatAccountIdentity
from main import app
from test_profile import asset, profile_service
import test_garment_postgres
import test_wechat_postgres
import test_wear_postgres

postgres_database = test_wechat_postgres.postgres_database
OLD_HEAD = "d6ec6e2bad7c"


def picture():
    output = BytesIO()
    Image.new("RGB", (24, 32), "blue").save(output, format="JPEG")
    return output.getvalue()


def media_service(db, store):
    return MediaService(MediaRepository(db), RevisionRepository(db), store)


def setup_profile(postgres_database, tmp_path):
    engine, migrate = postgres_database
    migrate("head")
    owner = test_garment_postgres.create_owner(engine)
    with Session(engine) as db:
        media_id = (
            media_service(db, MediaStore(tmp_path))
            .upload(owner, "avatar", "avatar", picture())
            .id
        )
        with transaction(db):
            row = db.get(MediaAsset, media_id)
            row.created_at = datetime.now(timezone.utc) - timedelta(days=2)
            storage_key = row.storage_key
    return engine, owner, media_id, storage_key


def test_version_migration_preserves_old_profile_inventory_and_history(
    postgres_database,
):
    engine, migrate = postgres_database
    migrate(OLD_HEAD)
    legacy_avatar = uuid4()
    garment_id, record_id = uuid4(), uuid4()
    with engine.begin() as connection:
        owner = connection.scalar(
            text("INSERT INTO users(username) VALUES ('legacy-profile') RETURNING id")
        )
        connection.execute(
            text(
                "INSERT INTO user_profiles(user_id,nickname,avatar_media_id,city_id) VALUES (:owner,:nickname,:avatar,:city)"
            ),
            {
                "owner": owner,
                "nickname": "保留昵称",
                "avatar": legacy_avatar,
                "city": "legacy-city",
            },
        )
        connection.execute(
            text(
                "INSERT INTO account_revisions(owner_id,inventory_revision,history_revision) VALUES (:owner,1,1)"
            ),
            {"owner": owner},
        )
        # 旧 schema 仅按当时已有的列建档，不能使用会读取新增列的当前 Service。
        connection.execute(
            text(
                "INSERT INTO garments(id,owner_id,name,season,occasion,tags,status,version,created_at,updated_at) "
                "VALUES (:garment,:owner,'保留衣物','[]','[]','[]','wearable',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            ),
            {"garment": garment_id, "owner": owner},
        )
        connection.execute(
            text(
                "INSERT INTO wear_records(id,owner_id,wear_date,version,created_at,updated_at) "
                "VALUES (:record,:owner,:day,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"
            ),
            {"record": record_id, "owner": owner, "day": date(2020, 1, 1)},
        )
        connection.execute(
            text(
                "INSERT INTO wear_record_items(record_id,garment_id,name_snapshot) "
                "VALUES (:record,:garment,'保留衣物')"
            ),
            {"record": record_id, "garment": garment_id},
        )
    migrate("head")
    with Session(engine) as db:
        profile = profile_service(db).get_profile(owner)
        assert (
            profile.nickname,
            profile.avatar_media_id,
            profile.city_id,
            profile.version,
        ) == ("保留昵称", legacy_avatar, "legacy-city", 1)
        assert test_garment_postgres.garments(db).get(owner, garment_id).wear_count == 1
        assert (
            test_wear_postgres.history(db).get(owner, record_id).items[0].name_snapshot
            == "保留衣物"
        )
        revision = db.get(AccountRevision, owner)
        assert (revision.inventory_revision, revision.history_revision) == (1, 1)
    assert "ck_profile_version_positive" in {
        c["name"] for c in inspect(engine).get_check_constraints("user_profiles")
    }
    assert not any(
        "avatar_media_id" in fk["constrained_columns"]
        for fk in inspect(engine).get_foreign_keys("user_profiles")
    )
    with pytest.raises(IntegrityError):
        with engine.begin() as connection:
            connection.execute(
                text("UPDATE user_profiles SET version=0 WHERE user_id=:owner"),
                {"owner": owner},
            )
    with Session(engine) as db:
        assert db.get(UserProfile, owner).version == 1
        with transaction(db):
            user = User(username="new-profile-after-upgrade")
            db.add(user)
            db.flush()
            assert ProfileRepository(db).create(user.id).version == 1
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


def test_same_version_concurrency_refreshes_preloaded_profile(
    postgres_database, tmp_path
):
    engine, owner, _, _ = setup_profile(postgres_database, tmp_path)
    barrier = Barrier(2)

    def save(name):
        with Session(engine) as db:
            service = profile_service(db)
            assert service.get_profile(owner).version == 1
            barrier.wait(timeout=10)
            try:
                return service.patch(
                    owner, ProfilePatch(expected_version=1, nickname=name)
                )
            except BusinessException as error:
                return error

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(save, ["草稿一", "草稿二"]))
    success = [r for r in results if not isinstance(r, BusinessException)]
    failures = [r for r in results if isinstance(r, BusinessException)]
    assert len(success) == len(failures) == 1
    assert success[0].version == 2 and failures[0].code == 40950
    with Session(engine) as db:
        row = db.get(UserProfile, owner)
        assert (row.version, row.nickname) == (2, success[0].nickname)
        revision = db.get(AccountRevision, owner)
        assert (revision.inventory_revision, revision.history_revision) == (0, 0)


def test_profile_binding_wins_cleanup_keeps_real_file(postgres_database, tmp_path):
    engine, owner, media_id, storage_key = setup_profile(postgres_database, tmp_path)
    bound, resume, cleanup_waiting = Event(), Event(), Event()

    class PausedProfileRepository(ProfileRepository):
        def flush(self):
            super().flush()
            bound.set()
            assert resume.wait(timeout=10)

    class ObservedRevisionRepository(RevisionRepository):
        def lock(self, owner_id):
            cleanup_waiting.set()
            return super().lock(owner_id)

    def bind():
        with Session(engine) as db:
            return ProfileService(
                PausedProfileRepository(db),
                RevisionRepository(db),
                MediaRepository(db),
                RegionRepository(db),
            ).patch(owner, ProfilePatch(expected_version=1, avatar_media_id=media_id))

    def cleanup():
        with Session(engine) as db:
            return MediaService(
                MediaRepository(db),
                ObservedRevisionRepository(db),
                MediaStore(tmp_path),
            ).cleanup()

    with ThreadPoolExecutor(max_workers=2) as pool:
        writer = pool.submit(bind)
        try:
            assert bound.wait(timeout=10)
            cleaner = pool.submit(cleanup)
            assert cleanup_waiting.wait(timeout=10)
            assert not cleaner.done()
            resume.set()
            assert writer.result(timeout=10).avatar_media_id == media_id
            assert cleaner.result(timeout=10).skipped == 1
        finally:
            resume.set()
    with Session(engine) as db:
        assert db.get(MediaAsset, media_id).status == "ready"
        assert db.get(UserProfile, owner).avatar_media_id == media_id
    assert MediaStore(tmp_path).path(storage_key).is_file()


def test_cleanup_wins_profile_binding_fails_without_waiting_for_file_io(
    postgres_database, tmp_path
):
    engine, owner, media_id, storage_key = setup_profile(postgres_database, tmp_path)
    deleting, resume = Event(), Event()

    class PausedStore(MediaStore):
        def remove(self, key):
            deleting.set()
            assert resume.wait(timeout=10)
            super().remove(key)

    def cleanup():
        with Session(engine) as db:
            return media_service(db, PausedStore(tmp_path)).cleanup()

    with ThreadPoolExecutor(max_workers=1) as pool:
        cleaner = pool.submit(cleanup)
        try:
            assert deleting.wait(timeout=10)
            with Session(engine) as db:
                with pytest.raises(BusinessException) as error:
                    profile_service(db).patch(
                        owner,
                        ProfilePatch(
                            expected_version=1,
                            nickname="不能保存",
                            avatar_media_id=media_id,
                        ),
                    )
                assert error.value.code == 42250
            resume.set()
            assert cleaner.result(timeout=10).deleted == 1
        finally:
            resume.set()
    with Session(engine) as db:
        row = db.get(UserProfile, owner)
        assert (row.version, row.nickname, row.avatar_media_id) == (1, None, None)
        assert db.get(MediaAsset, media_id).status == "deleted"
    assert not MediaStore(tmp_path).path(storage_key).exists()


def test_pg_commit_failure_preserves_old_binding_and_new_upload(
    postgres_database, tmp_path
):
    engine, owner, old_avatar, storage_key = setup_profile(postgres_database, tmp_path)
    with Session(engine) as db:
        service = profile_service(db)
        service.patch(
            owner,
            ProfilePatch(
                expected_version=1, nickname="旧资料", avatar_media_id=old_avatar
            ),
        )
        new_avatar = (
            media_service(db, MediaStore(tmp_path))
            .upload(owner, "avatar", "replacement", picture())
            .id
        )

        def fail_commit(session):
            raise RuntimeError("injected PostgreSQL profile commit failure")

        event.listen(db, "before_commit", fail_commit)
        try:
            with pytest.raises(RuntimeError, match="profile commit"):
                service.patch(
                    owner,
                    ProfilePatch(
                        expected_version=2,
                        nickname="未保存",
                        avatar_media_id=new_avatar,
                    ),
                )
        finally:
            event.remove(db, "before_commit", fail_commit)
        db.expire_all()
        row = db.get(UserProfile, owner)
        assert (row.version, row.nickname, row.avatar_media_id) == (
            2,
            "旧资料",
            old_avatar,
        )
        assert db.get(MediaAsset, new_avatar).status == "ready"
        assert media_service(db, MediaStore(tmp_path)).cleanup().deleted == 0
        assert (
            MediaStore(tmp_path)
            .path(db.get(MediaAsset, new_avatar).storage_key)
            .is_file()
        )
    assert MediaStore(tmp_path).path(storage_key).is_file()


def test_real_profile_http_avatar_default_roundtrip_and_session(
    postgres_database, tmp_path, monkeypatch
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
    prefix = f"profile-api-test-{uuid4().hex}:"
    monkeypatch.setattr(auth_redis_service, "TOKEN_BLACKLIST_PREFIX", prefix + "jwt:")
    monkeypatch.setattr(cache_service, "USER_CACHE_PREFIX", prefix + "user:")
    for module in (redis_module, auth_redis_service, cache_service):
        monkeypatch.setattr(module, "redis_client", redis)

    class Exchange:
        def exchange(self, code):
            return WechatAccountIdentity("wx-profile-api-test", code)

    def database_session():
        with Session(engine) as db:
            yield db

    def media(db=Depends(get_db)):
        return media_service(db, MediaStore(tmp_path))

    app.dependency_overrides[get_db] = database_session
    app.dependency_overrides[get_wechat_code_exchange] = Exchange
    app.dependency_overrides[get_media_service] = media
    captured = {}

    def data(response):
        assert response.status_code == 200, response.text
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
            initial = captured["default"] = data(
                client.get("/api/v1/profile", headers=own)
            )
            assert initial == {
                "user_id": sessions[0]["user"]["id"],
                "nickname": None,
                "avatar_media_id": None,
                "city_id": None,
                "version": 1,
            }
            assert client.get("/api/v1/profile").status_code == 401
            assert (
                client.patch(
                    "/api/v1/profile", json={"expected_version": 1}
                ).status_code
                == 401
            )

            def upload(headers, purpose, key):
                return data(
                    client.post(
                        "/api/v1/media",
                        headers={**headers, "Idempotency-Key": key},
                        data={"purpose": purpose},
                        files={"file": ("test.jpg", picture(), "image/jpeg")},
                    )
                )

            avatar = captured["avatar_ready"] = upload(own, "avatar", "avatar")
            garment = captured["garment_ready"] = upload(own, "garment", "garment")
            foreign_avatar = upload(other, "avatar", "avatar")
            assert avatar["purpose"] == "avatar" and garment["purpose"] == "garment"
            assert "storage_key" not in avatar and "url" not in avatar
            for key in ("city_id", "timezone", "phone", "owner_id"):
                assert (
                    client.patch(
                        "/api/v1/profile",
                        headers=own,
                        json={"expected_version": 1, key: "untrusted"},
                    ).status_code
                    == 422
                )
            for version in (True, "1", 0, None):
                assert (
                    client.patch(
                        "/api/v1/profile",
                        headers=own,
                        json={"expected_version": version},
                    ).status_code
                    == 422
                )
            assert (
                client.patch(
                    "/api/v1/profile",
                    headers=own,
                    json={"expected_version": 1, "nickname": "名" * 81},
                ).status_code
                == 422
            )
            assert (
                client.patch(
                    "/api/v1/profile", headers=own, json={"nickname": "missing-version"}
                ).status_code
                == 422
            )
            for media_id, status in [
                (foreign_avatar["id"], 404),
                (str(uuid4()), 404),
                (garment["id"], 422),
            ]:
                assert (
                    client.patch(
                        "/api/v1/profile",
                        headers=own,
                        json={"expected_version": 1, "avatar_media_id": media_id},
                    ).status_code
                    == status
                )
            with Session(engine) as db:
                invalid = [
                    str(asset(db, initial["user_id"], status=status))
                    for status in ("pending", "deleting", "deleted")
                ]
            for media_id in invalid:
                assert (
                    client.patch(
                        "/api/v1/profile",
                        headers=own,
                        json={"expected_version": 1, "avatar_media_id": media_id},
                    ).status_code
                    == 422
                )
            assert data(client.get("/api/v1/profile", headers=own)) == initial
            saved = captured["saved"] = data(
                client.patch(
                    "/api/v1/profile",
                    headers=own,
                    json={
                        "expected_version": 1,
                        "nickname": "  测试昵称  ",
                        "avatar_media_id": avatar["id"],
                    },
                )
            )
            assert saved == {
                **initial,
                "nickname": "测试昵称",
                "avatar_media_id": avatar["id"],
                "version": 2,
            }
            captured["reread"] = data(client.get("/api/v1/profile", headers=own))
            assert captured["reread"] == saved
            assert (
                data(client.get("/api/v1/profile", headers=other))["avatar_media_id"]
                is None
            )
            content = client.get(f"/api/v1/media/{avatar['id']}/content", headers=own)
            assert content.status_code == 200 and content.content.startswith(
                b"\xff\xd8"
            )
            assert content.headers["cache-control"] == "private, no-store"
            assert (
                client.get(
                    f"/api/v1/media/{avatar['id']}/content", headers=other
                ).status_code
                == 404
            )
            assert (
                client.patch(
                    "/api/v1/profile",
                    headers=own,
                    json={"expected_version": 1, "nickname": "旧草稿"},
                ).status_code
                == 409
            )
            expected_only = data(
                client.patch(
                    "/api/v1/profile", headers=own, json={"expected_version": 2}
                )
            )
            assert expected_only == {**saved, "version": 3}
            cleared = captured["cleared"] = data(
                client.patch(
                    "/api/v1/profile",
                    headers=own,
                    json={
                        "expected_version": 3,
                        "nickname": None,
                        "avatar_media_id": None,
                    },
                )
            )
            assert cleared == {**initial, "version": 4}
            assert data(client.get("/api/v1/profile", headers=own)) == cleared
            data(client.post("/api/v1/auth/logout", headers=own))
            assert client.get("/api/v1/profile", headers=own).status_code == 401
            assert (
                client.get(
                    f"/api/v1/media/{avatar['id']}/content", headers=own
                ).status_code
                == 401
            )
            assert client.get("/api/v1/profile", headers=other).status_code == 200

        output = os.environ.get("WARDROBE_PROFILE_CONSUMER_RESPONSES")
        if output:
            target = Path(output).resolve()
            expected = (
                Path(__file__).resolve().parents[2]
                / ".tools/manager-runtime/profile-consumer-responses.json"
            )
            assert target == expected.resolve()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(
                json.dumps(captured, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
    finally:
        for dependency in (get_db, get_wechat_code_exchange, get_media_service):
            app.dependency_overrides.pop(dependency, None)
        keys = list(redis.scan_iter(match=prefix + "*"))
        if keys:
            redis.delete(*keys)
        redis.close()
