"""明确 opt-in 的隔离 PostgreSQL/Redis 事务、迁移和媒体授权链。"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from io import BytesIO
import os
from threading import Barrier, Event
from uuid import uuid4

from fastapi import Depends
from fastapi.testclient import TestClient
from PIL import Image
import pytest
from redis import Redis
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.api.dependencies import get_media_service, get_wechat_code_exchange
from app.core import redis_client as redis_module
from app.core.exceptions import BusinessException
from app.core.session import get_db
from app.models.account_revision import AccountRevision
from app.models.garment import Garment
from app.models.idempotency_receipt import IdempotencyReceipt
from app.models.media_asset import MediaAsset
from app.repositories.garment_repository import GarmentRepository
from app.repositories.idempotency_repository import IdempotencyRepository
from app.repositories.media_repository import MediaRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.revision_repository import RevisionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.garment import GarmentCreate, GarmentPatch
from app.services import auth_redis_service, cache_service
from app.services.auth_service import AuthService
from app.services.garment_service import GarmentService
from app.services.media_service import MediaService
from app.services.media_store import MediaStore
from app.services.wechat_service import WechatAccountIdentity
from main import app
import test_wechat_postgres

postgres_database = test_wechat_postgres.postgres_database


def garments(db, revisions=None, receipts=None):
    return GarmentService(
        GarmentRepository(db),
        revisions or RevisionRepository(db),
        receipts or IdempotencyRepository(db),
        MediaRepository(db),
        "test-cursor-only",
    )


def create_owner(engine):
    with Session(engine) as db:
        return (
            AuthService(UserRepository(db), ProfileRepository(db))
            .register("owner", "password")
            .id
        )


def test_previous_head_backfills_revision_and_initializes_new_accounts(
    postgres_database,
):
    engine, migrate = postgres_database
    migrate("5f4c7978c111")
    with engine.begin() as connection:
        old_id = connection.scalar(
            text(
                "INSERT INTO users(username,password_hash) VALUES ('old',NULL) RETURNING id"
            )
        )
    migrate("head")
    with Session(engine) as db:
        assert db.get(AccountRevision, old_id).inventory_revision == 0
        new = AuthService(UserRepository(db), ProfileRepository(db)).register(
            "new", "password"
        )
        assert db.get(AccountRevision, new.id).inventory_revision == 0


def test_concurrent_create_and_edit_are_serialized(postgres_database):
    engine, migrate = postgres_database
    migrate("head")
    owner_id = create_owner(engine)
    barrier = Barrier(2)

    def create(index):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            return garments(db).create(
                owner_id,
                GarmentCreate(name="相同衣物", season=["spring"], tags=["明确标签"]),
                "same-key",
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        created = list(pool.map(create, range(2)))
    assert created[0] == created[1]
    garment_id = created[0].id
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(Garment)) == 1
        assert db.scalar(select(func.count()).select_from(IdempotencyReceipt)) == 1
        assert db.get(AccountRevision, owner_id).inventory_revision == 1
        assert (
            len(
                garments(db)
                .list(owner_id, {"season": "spring", "tag": "明确标签"}, None, 20)
                .items
            )
            == 1
        )
    barrier.reset()

    def edit(index):
        with Session(engine) as db:
            barrier.wait(timeout=10)
            try:
                result = garments(db).patch(
                    owner_id,
                    garment_id,
                    GarmentPatch(expected_version=1, name=f"edit-{index}"),
                )
                return result.version
            except BusinessException as error:
                assert error.status_code == 409
                return "conflict"

    with ThreadPoolExecutor(max_workers=2) as pool:
        edited = list(pool.map(edit, range(2)))
    assert sorted(map(str, edited)) == ["2", "conflict"]
    with Session(engine) as db:
        assert db.get(Garment, garment_id).version == 2
        assert db.get(AccountRevision, owner_id).inventory_revision == 2
        # 修改当前衣物不影响创建收据，也不重复增加 revision。
        assert (
            garments(db).create(
                owner_id,
                GarmentCreate(name="相同衣物", season=["spring"], tags=["明确标签"]),
                "same-key",
            )
            == created[0]
        )
        assert db.get(AccountRevision, owner_id).inventory_revision == 2


@pytest.mark.parametrize("failure", ["receipt", "revision"])
def test_write_failure_rolls_back_all_inventory_facts(postgres_database, failure):
    engine, migrate = postgres_database
    migrate("head")
    owner_id = create_owner(engine)

    class FailingReceipt(IdempotencyRepository):
        def create(self, *args, **kwargs):
            super().create(*args, **kwargs)
            raise RuntimeError("injected receipt failure")

    class FailingRevision(RevisionRepository):
        def increment_inventory(self, revision):
            super().increment_inventory(revision)
            raise RuntimeError("injected revision failure")

    with Session(engine) as db:
        service = garments(
            db,
            revisions=FailingRevision(db) if failure == "revision" else None,
            receipts=FailingReceipt(db) if failure == "receipt" else None,
        )
        with pytest.raises(RuntimeError, match="injected"):
            service.create(owner_id, GarmentCreate(name="x"), "retry")
        assert db.scalar(select(func.count()).select_from(Garment)) == 0
        assert db.scalar(select(func.count()).select_from(IdempotencyReceipt)) == 0
        assert db.get(AccountRevision, owner_id).inventory_revision == 0
        assert (
            garments(db).create(owner_id, GarmentCreate(name="x"), "retry").version == 1
        )


@pytest.mark.parametrize("winner", ["binding", "cleanup"])
def test_binding_cleanup_race_preserves_reference_or_rejects(
    postgres_database, tmp_path, winner
):
    engine, migrate = postgres_database
    migrate("head")
    owner_id = create_owner(engine)
    store = MediaStore(tmp_path)
    raw = BytesIO()
    Image.new("RGB", (3, 4), "blue").save(raw, format="PNG")
    with Session(engine) as db:
        media = MediaService(MediaRepository(db), RevisionRepository(db), store).upload(
            owner_id, "garment", "upload", raw.getvalue()
        )
        media_id = media.id
        path = store.path(media.storage_key)
        media.created_at = datetime.now(timezone.utc) - timedelta(days=2)
        db.commit()
    first_locked, release = Event(), Event()

    class PausingRevisions(RevisionRepository):
        def lock(self, owner_id):
            row = super().lock(owner_id)
            if not first_locked.is_set():
                first_locked.set()
                assert release.wait(timeout=10)
            return row

    def bind(pause):
        with Session(engine) as db:
            try:
                return (
                    garments(db, PausingRevisions(db) if pause else None)
                    .create(owner_id, GarmentCreate(photo_media_id=media_id), "binding")
                    .id
                )
            except BusinessException as error:
                assert error.status_code == 422
                return None

    def clean(pause):
        with Session(engine) as db:
            return MediaService(
                MediaRepository(db),
                PausingRevisions(db) if pause else RevisionRepository(db),
                store,
            ).cleanup()

    with ThreadPoolExecutor(max_workers=2) as pool:
        if winner == "binding":
            first = pool.submit(bind, True)
            assert first_locked.wait(timeout=10)
            second = pool.submit(clean, False)
        else:
            first = pool.submit(clean, True)
            assert first_locked.wait(timeout=10)
            second = pool.submit(bind, False)
        release.set()
        results = first.result(timeout=15), second.result(timeout=15)
    with Session(engine) as db:
        media = db.get(MediaAsset, media_id)
        rows = db.query(Garment).all()
        if winner == "binding":
            assert len(rows) == 1 and rows[0].photo_media_id == media_id
            assert media.status == "ready" and path.exists()
            assert results[1].deleted == 0
        else:
            assert rows == [] and media.status == "deleted" and not path.exists()
            assert results[1] is None


def test_real_redis_wechat_media_garment_authorization_chain(
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
    real_redis = Redis.from_url(
        redis_url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2
    )
    assert real_redis.ping()
    prefix = f"garment-test-{uuid4().hex}:"
    monkeypatch.setattr(auth_redis_service, "TOKEN_BLACKLIST_PREFIX", f"{prefix}jwt:")
    monkeypatch.setattr(cache_service, "USER_CACHE_PREFIX", f"{prefix}user:")
    for module in (redis_module, auth_redis_service, cache_service):
        monkeypatch.setattr(module, "redis_client", real_redis)

    class Exchange:
        def exchange(self, code):
            return WechatAccountIdentity("wx-internal-chain", code)

    def database_session():
        with Session(engine) as db:
            yield db

    def media_service(db=Depends(get_db)):
        return MediaService(
            MediaRepository(db), RevisionRepository(db), MediaStore(tmp_path)
        )

    app.dependency_overrides[get_db] = database_session
    app.dependency_overrides[get_wechat_code_exchange] = Exchange
    app.dependency_overrides[get_media_service] = media_service
    try:
        with TestClient(app) as client:
            sessions = [
                client.post("/api/v1/auth/wechat", json={"code": code}).json()["data"]
                for code in ("a", "b")
            ]
            headers, other = [
                {"Authorization": f"Bearer {session['access_token']}"}
                for session in sessions
            ]
            raw = BytesIO()
            Image.new("RGB", (4, 5), "red").save(raw, format="PNG")
            upload = client.post(
                "/api/v1/media",
                headers={**headers, "Idempotency-Key": "photo"},
                data={"purpose": "garment"},
                files={"file": ("photo.png", raw.getvalue(), "image/png")},
            )
            assert upload.status_code == 200
            media_id = upload.json()["data"]["id"]
            created = client.post(
                "/api/v1/garments",
                headers={**headers, "Idempotency-Key": "one"},
                json={"photo_media_id": media_id},
            )
            assert created.status_code == 200
            garment_id = created.json()["data"]["id"]
            assert (
                client.get(
                    f"/api/v1/media/{media_id}/content", headers=headers
                ).status_code
                == 200
            )
            assert (
                client.get(
                    f"/api/v1/media/{media_id}/content", headers=other
                ).status_code
                == 404
            )
            assert (
                client.get(f"/api/v1/garments/{garment_id}", headers=other).status_code
                == 404
            )
            assert (
                client.post(
                    "/api/v1/garments",
                    headers={**other, "Idempotency-Key": "one"},
                    json={"photo_media_id": media_id},
                ).status_code
                == 404
            )
            assert (
                client.get("/api/v1/garments", headers=other).json()["data"]["items"]
                == []
            )
            assert (
                client.patch(
                    f"/api/v1/garments/{garment_id}",
                    headers=headers,
                    json={"expected_version": 1, "status": "archived"},
                ).status_code
                == 200
            )
            assert (
                client.post("/api/v1/auth/logout", headers=headers).status_code == 200
            )
            assert (
                client.get(
                    f"/api/v1/media/{media_id}/content", headers=headers
                ).status_code
                == 401
            )
            assert (
                client.get(
                    f"/api/v1/garments/{garment_id}", headers=headers
                ).status_code
                == 401
            )
        with Session(engine) as db:
            assert (
                db.get(AccountRevision, sessions[0]["user"]["id"]).inventory_revision
                == 2
            )
            assert (
                db.get(AccountRevision, sessions[1]["user"]["id"]).inventory_revision
                == 0
            )
    finally:
        for dependency in (get_db, get_wechat_code_exchange, get_media_service):
            app.dependency_overrides.pop(dependency, None)
        keys = list(real_redis.scan_iter(match=f"{prefix}*"))
        if keys:
            real_redis.delete(*keys)
        real_redis.close()
