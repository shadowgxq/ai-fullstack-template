"""Isolated SQLite and Redis fixtures; never inherit a real service DSN."""

import os

os.environ["DATABASE_URL"] = "postgresql+psycopg2://test:test@localhost:5432/test"
os.environ["REDIS_URL"] = "redis://localhost:6379/15"
os.environ["SECRET_KEY"] = "test-secret-key-only-for-tests"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.core import redis_client as redis_module
from app.core.base import Base
from app.core.session import get_db
from app.models import user as _user  # noqa: F401
from main import app


class FakePipeline:
    """Queue the commands used by authentication; real MULTI is checked by stack smoke."""

    def __init__(self, redis):
        self.redis = redis
        self.commands = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.commands.clear()

    def incr(self, key):
        self.commands.append(("incr", (key,), {}))
        return self

    def expire(self, key, seconds, nx=False):
        self.commands.append(("expire", (key, seconds), {"nx": nx}))
        return self

    def execute(self):
        return [
            getattr(self.redis, op)(*args, **kwargs)
            for op, args, kwargs in self.commands
        ]


class FakeRedis:
    """Small command fake. TTL assignment is recorded; wall-clock expiry is not simulated."""

    def __init__(self):
        self.store = {}
        self.expiries = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ex=None):
        self.store[key] = value
        if ex is not None:
            self.expiries[key] = ex
        return True

    def incr(self, key):
        self.store[key] = str(int(self.store.get(key, 0)) + 1)
        return int(self.store[key])

    def expire(self, key, seconds, nx=False):
        if key not in self.store or (nx and key in self.expiries):
            return False
        self.expiries[key] = seconds
        return True

    def delete(self, key):
        self.expiries.pop(key, None)
        return int(self.store.pop(key, None) is not None)

    def exists(self, key):
        return int(key in self.store)

    def pipeline(self, transaction=True):
        assert transaction is True
        return FakePipeline(self)


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch):
    from app.services import auth_redis_service, cache_service

    fake = FakeRedis()
    for module in (redis_module, auth_redis_service, cache_service):
        monkeypatch.setattr(module, "redis_client", fake)
    return fake


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine, autoflush=False)() as session:
        yield session
    engine.dispose()


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as value:
            yield value
    finally:
        app.dependency_overrides.clear()
