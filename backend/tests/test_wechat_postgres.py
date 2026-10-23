"""显式 opt-in 的本次隔离 PostgreSQL 迁移、身份竞争与回滚检查。"""

from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import subprocess
import sys
from threading import Barrier
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from redis import Redis
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session
from sqlalchemy.schema import CreateSchema, DropSchema

from app.core.security import decode_access_token, hash_password
from app.core import redis_client as redis_module
from app.core.session import get_db
from app.api.dependencies import get_wechat_code_exchange
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.wechat_identity import WechatIdentity
from app.repositories.profile_repository import ProfileRepository
from app.repositories.user_repository import UserRepository
from app.repositories.wechat_identity_repository import WechatIdentityRepository
from app.services.auth_service import AuthService
from app.services import auth_redis_service, cache_service
from app.services.wechat_service import WechatAccountIdentity, WechatAuthService
from main import app

BACKEND_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def postgres_database():
    dsn = os.environ.get("WARDROBE_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip(
            "WARDROBE_TEST_DATABASE_URL must explicitly select the isolated test DB"
        )
    url = make_url(dsn)
    # 只允许本次新建的专用目标，不能因测试命名而清理其它 localhost 数据。
    if (url.host, url.port, url.username, url.database) != (
        "127.0.0.1",
        55432,
        "wardrobe_test",
        "wardrobe_test",
    ):
        pytest.fail(
            "DSN is outside the authorized wardrobe-manager isolated PostgreSQL"
        )
    schema = f"wechat_test_{uuid4().hex}"
    admin = create_engine(url)
    with admin.begin() as connection:
        connection.execute(CreateSchema(schema))
    isolated_url = url.update_query_dict({"options": f"-csearch_path={schema}"})
    engine = create_engine(isolated_url)

    def migrate(target):
        env = dict(
            os.environ, DATABASE_URL=isolated_url.render_as_string(hide_password=False)
        )
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", target],
            cwd=BACKEND_ROOT,
            env=env,
            check=True,
            capture_output=True,
            text=True,
            timeout=30,
        )

    try:
        yield engine, migrate
    finally:
        engine.dispose()
        # 只删除本 fixture 通过 UUID 生成并实际创建的独有 schema。
        with admin.begin() as connection:
            connection.execute(DropSchema(schema, cascade=True))
        admin.dispose()


def test_migration_backfills_profile_and_preserves_old_password(postgres_database):
    engine, migrate = postgres_database
    migrate("ab8ad8fec86b")
    old_hash = hash_password("old-password")
    with engine.begin() as connection:
        old_id = connection.scalar(
            text(
                "INSERT INTO users (username,password_hash) VALUES (:name,:hash) RETURNING id"
            ),
            {"name": "before-migration", "hash": old_hash},
        )
    migrate("head")
    with Session(engine) as db:
        profile = db.get(UserProfile, old_id)
        assert profile is not None
        assert (profile.nickname, profile.avatar_media_id, profile.city_id) == (
            None,
            None,
            None,
        )
        assert db.get(User, old_id).password_hash == old_hash
        token = AuthService(UserRepository(db), ProfileRepository(db)).login(
            "before-migration", "old-password"
        )
        assert decode_access_token(token)["sub"] == str(old_id)
    columns = {
        column["name"]: column for column in inspect(engine).get_columns("users")
    }
    assert columns["password_hash"]["nullable"] is True
    assert "timezone" not in {
        column["name"] for column in inspect(engine).get_columns("user_profiles")
    }


def test_concurrent_same_identity_has_one_user_and_profile(postgres_database):
    engine, migrate = postgres_database
    migrate("head")
    barrier = Barrier(2)

    class RacingIdentityRepository(WechatIdentityRepository):
        first_read = True

        def get_user(self, app_id, open_id):
            user = super().get_user(app_id, open_id)
            if self.first_read:
                self.first_read = False
                assert user is None
                barrier.wait(timeout=10)
            return user

    class Exchange:
        def __init__(self, db):
            self.db = db

        def exchange(self, code):
            assert not self.db.in_transaction()
            return WechatAccountIdentity("wx-concurrent", "same-owner")

    def login(index):
        with Session(engine) as db:
            service = WechatAuthService(
                UserRepository(db),
                RacingIdentityRepository(db),
                ProfileRepository(db),
                Exchange(db),
            )
            token, user = service.login(f"different-code-{index}")
            assert decode_access_token(token)["sub"] == str(user.id)
            return user.id

    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(login, range(2)))
    assert ids[0] == ids[1]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(User)) == 1
        assert db.scalar(select(func.count()).select_from(UserProfile)) == 1
        assert db.scalar(select(func.count()).select_from(WechatIdentity)) == 1


def test_failed_profile_write_rolls_back_all_account_facts(postgres_database):
    engine, migrate = postgres_database
    migrate("head")

    class FailingProfileRepository(ProfileRepository):
        def create(self, user_id):
            super().create(user_id)
            raise RuntimeError("injected failure after all account rows were flushed")

    class Exchange:
        def exchange(self, code):
            return WechatAccountIdentity("wx-rollback", "owner")

    with Session(engine) as db:
        service = WechatAuthService(
            UserRepository(db),
            WechatIdentityRepository(db),
            FailingProfileRepository(db),
            Exchange(),
        )
        with pytest.raises(RuntimeError, match="injected failure"):
            service.login("code")
        for model in (User, UserProfile, WechatIdentity):
            assert db.scalar(select(func.count()).select_from(model)) == 0
        retry = WechatAuthService(
            UserRepository(db),
            WechatIdentityRepository(db),
            ProfileRepository(db),
            Exchange(),
        )
        _, user = retry.login("fresh-code")
        assert db.get(UserProfile, user.id) is not None


def test_real_postgres_and_redis_auth_profile_logout_chain(
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
    real_redis = Redis.from_url(
        redis_url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2
    )
    assert real_redis.ping()
    prefix = f"wechat-test-{uuid4().hex}:"
    monkeypatch.setattr(auth_redis_service, "TOKEN_BLACKLIST_PREFIX", f"{prefix}jwt:")
    monkeypatch.setattr(cache_service, "USER_CACHE_PREFIX", f"{prefix}user:")
    for module in (redis_module, auth_redis_service, cache_service):
        monkeypatch.setattr(module, "redis_client", real_redis)

    class Exchange:
        def exchange(self, code):
            return WechatAccountIdentity("wx-real-internal-chain", code)

    def database_session():
        with Session(engine) as db:
            yield db

    app.dependency_overrides[get_db] = database_session
    app.dependency_overrides[get_wechat_code_exchange] = lambda: Exchange()
    created_keys = set()
    try:
        with TestClient(app) as client:
            responses = [
                client.post("/api/v1/auth/wechat", json={"code": code})
                for code in ("owner-a", "owner-b")
            ]
            assert all(response.status_code == 200 for response in responses)
            sessions = [response.json()["data"] for response in responses]
            for session in sessions:
                token = session["access_token"]
                created_keys.add(
                    auth_redis_service.get_token_blacklist_key(
                        decode_access_token(token)["jti"]
                    )
                )
                created_keys.add(
                    cache_service.get_user_cache_key(session["user"]["id"])
                )
                own = client.get(
                    "/api/v1/profile", headers={"Authorization": f"Bearer {token}"}
                )
                assert own.status_code == 200
                assert own.json()["data"]["user_id"] == session["user"]["id"]
            assert sessions[0]["user"]["id"] != sessions[1]["user"]["id"]
            first_token = sessions[0]["access_token"]
            first_headers = {"Authorization": f"Bearer {first_token}"}
            assert (
                client.post("/api/v1/auth/logout", headers=first_headers).status_code
                == 200
            )
            revoked_key = auth_redis_service.get_token_blacklist_key(
                decode_access_token(first_token)["jti"]
            )
            assert real_redis.exists(revoked_key) == 1
            assert real_redis.ttl(revoked_key) > 0
            assert (
                client.get("/api/v1/profile", headers=first_headers).status_code == 401
            )
            assert (
                client.get(
                    "/api/v1/profile",
                    headers={"Authorization": f"Bearer {sessions[1]['access_token']}"},
                ).status_code
                == 200
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_wechat_code_exchange, None)
        if created_keys:
            real_redis.delete(*created_keys)
        real_redis.close()
