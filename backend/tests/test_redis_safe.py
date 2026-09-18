"""Cache may degrade; authentication must not bypass security or fake logout."""

import pytest
from redis.exceptions import RedisError
from app.core.exceptions import AuthDependencyUnavailable
from app.services import auth_redis_service as ars, cache_service as cs


def unavailable(*args, **kwargs):
    raise RedisError("redis://secret-host:private-password@host unavailable")


def test_failure_counter_sets_fixed_window(fake_redis):
    assert ars.record_login_failure("u") == 1
    key = next(iter(fake_redis.expiries))
    fake_redis.expiries[key] = 42
    assert ars.record_login_failure("u") == 2
    assert fake_redis.expiries[key] == 42  # EXPIRE NX does not extend the window
    assert ars.get_login_fail_count("u") == 2


@pytest.mark.parametrize(
    "operation,method,args",
    [
        (ars.get_login_fail_count, "get", ("u",)),
        (ars.is_login_locked, "get", ("u",)),
        (ars.record_login_failure, "pipeline", ("u",)),
        (ars.clear_login_failure, "delete", ("u",)),
        (ars.blacklist_token, "set", ("token", 60)),
        (ars.is_token_blacklisted, "exists", ("token",)),
    ],
)
def test_auth_dependency_fails_closed(
    operation, method, args, fake_redis, monkeypatch, caplog
):
    monkeypatch.setattr(fake_redis, method, unavailable)
    with pytest.raises(AuthDependencyUnavailable):
        operation(*args)
    assert "private-password" not in caplog.text


def test_cache_can_degrade(fake_redis, monkeypatch, caplog):
    monkeypatch.setattr(fake_redis, "get", unavailable)
    monkeypatch.setattr(fake_redis, "set", unavailable)
    assert cs.get_json("k") is None
    assert cs.set_json("k", {"a": 1}) is None
    assert "private-password" not in caplog.text


def credentials(client):
    body = {"username": "review-user", "password": "pw-123456"}
    assert client.post("/api/v1/auth/register", json=body).status_code == 200
    response = client.post("/api/v1/auth/login", json=body)
    return body, {"Authorization": "Bearer " + response.json()["data"]["access_token"]}


def test_login_unavailable_does_not_issue_token(client, fake_redis, monkeypatch):
    body, _ = credentials(client)
    monkeypatch.setattr(fake_redis, "get", unavailable)
    response = client.post("/api/v1/auth/login", json=body)
    assert response.status_code == 503
    assert response.json() == {
        "code": 50301,
        "message": "Authentication temporarily unavailable",
        "data": None,
    }


def test_revocation_lookup_outage_denies_access(client, fake_redis, monkeypatch):
    _, headers = credentials(client)
    monkeypatch.setattr(fake_redis, "exists", unavailable)
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 503


def test_logout_requires_successful_persistence(client, fake_redis, monkeypatch):
    _, headers = credentials(client)
    with monkeypatch.context() as patch:
        patch.setattr(fake_redis, "set", unavailable)
        assert client.post("/api/v1/auth/logout", headers=headers).status_code == 503
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 200
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    revoked = client.get("/api/v1/auth/me", headers=headers)
    assert revoked.status_code == 401
    assert revoked.headers["WWW-Authenticate"] == "Bearer"
