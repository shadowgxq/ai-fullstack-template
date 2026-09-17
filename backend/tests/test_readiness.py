from unittest.mock import MagicMock
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy.exc import OperationalError
from app.api.v1 import health


def test_ready_checks_both_dependencies(client, monkeypatch):
    engine = MagicMock()
    redis = MagicMock()
    monkeypatch.setattr(health, "engine", engine)
    monkeypatch.setattr(health, "redis_client", redis)
    assert client.get("/ready").status_code == 200
    engine.connect.assert_called_once()
    redis.ping.assert_called_once()


def test_ready_does_not_confuse_live_and_ready(client, monkeypatch):
    engine = MagicMock()
    engine.connect.side_effect = OperationalError("SELECT", {}, Exception("private"))
    monkeypatch.setattr(health, "engine", engine)
    assert client.get("/health").status_code == 200
    result = client.get("/ready")
    assert result.status_code == 503
    assert "private" not in result.text


def test_redis_is_required_for_auth_readiness(client, monkeypatch):
    monkeypatch.setattr(health, "engine", MagicMock())
    redis = MagicMock()
    redis.ping.side_effect = RedisConnectionError("private")
    monkeypatch.setattr(health, "redis_client", redis)
    assert client.get("/ready").status_code == 503
