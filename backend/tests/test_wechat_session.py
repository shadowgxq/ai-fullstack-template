"""微信边界使用交换替身；账户/默认资料走真实 API、事务与认证链。"""

from io import BytesIO
import json
from sqlite3 import IntegrityError as SQLiteIntegrityError
from urllib.error import URLError

import pytest
from redis.exceptions import RedisError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.api.dependencies import get_wechat_code_exchange
from app.core.exceptions import (
    WechatDependencyUnavailable,
    WechatLoginFailedException,
)
from app.core.security import decode_access_token
from app.models.user import User
from app.models.user_profile import UserProfile
from app.models.wechat_identity import WechatIdentity
from app.repositories.profile_repository import ProfileRepository
from app.repositories.user_repository import UserRepository
from app.repositories.wechat_identity_repository import WechatIdentityRepository
from app.services import auth_redis_service, wechat_service
from app.services.wechat_service import (
    HttpWechatCodeExchange,
    WechatAccountIdentity,
    WechatAuthService,
)
from main import app

WECHAT = "/api/v1/auth/wechat"
PROFILE = "/api/v1/profile"


class StubExchange:
    def __init__(self, app_id="wx-test", open_id="same-identity"):
        self.identity = WechatAccountIdentity(app_id, open_id)
        self.codes = []

    def exchange(self, code):
        self.codes.append(code)
        return self.identity


@pytest.fixture
def exchange():
    value = StubExchange()
    app.dependency_overrides[get_wechat_code_exchange] = lambda: value
    yield value
    app.dependency_overrides.pop(get_wechat_code_exchange, None)


def bearer(response):
    return {"Authorization": f"Bearer {response.json()['data']['access_token']}"}


def count(db, model):
    return db.scalar(select(func.count()).select_from(model))


def test_repeated_wechat_login_and_default_profile(client, db_session, exchange):
    first = client.post(WECHAT, json={"code": "first-one-time-code"})
    again = client.post(WECHAT, json={"code": "next-one-time-code"})
    assert first.status_code == again.status_code == 200
    user = first.json()["data"]["user"]
    assert user == again.json()["data"]["user"]
    assert exchange.codes == ["first-one-time-code", "next-one-time-code"]
    assert first.json()["data"]["access_token"] != again.json()["data"]["access_token"]
    assert count(db_session, User) == count(db_session, WechatIdentity) == 1
    assert count(db_session, UserProfile) == 1
    assert db_session.get(User, user["id"]).password_hash is None
    assert client.get(PROFILE, headers=bearer(first)).json()["data"] == {
        "user_id": user["id"],
        "nickname": None,
        "avatar_media_id": None,
        "city_id": None,
        "version": 1,
    }
    failed_password = client.post(
        "/api/v1/auth/login",
        json={"username": user["username"], "password": "anything"},
    )
    assert failed_password.status_code == 401
    assert client.post("/api/v1/auth/logout", headers=bearer(first)).status_code == 200
    assert client.get(PROFILE, headers=bearer(first)).status_code == 401
    assert client.get(PROFILE, headers=bearer(again)).status_code == 200


def test_distinct_accounts_and_same_openid_in_different_apps(client, exchange):
    first = client.post(WECHAT, json={"code": "first"})
    first_user = first.json()["data"]["user"]["id"]
    exchange.identity = WechatAccountIdentity("another-app", "same-identity")
    second = client.post(WECHAT, json={"code": "second"})
    second_user = second.json()["data"]["user"]["id"]
    assert first_user != second_user
    # 即使客户端附上另一用户 ID，查询仍只能使用认证主体。
    result = client.get(f"{PROFILE}?user_id={first_user}", headers=bearer(second))
    assert result.json()["data"]["user_id"] == second_user
    assert client.get(PROFILE).status_code == 401
    assert (
        client.get(f"{PROFILE}/{first_user}", headers=bearer(second)).status_code == 404
    )


def test_password_registration_has_persisted_empty_profile(client):
    registered = client.post(
        "/api/v1/auth/register", json={"username": "legacy", "password": "old-password"}
    )
    login = client.post(
        "/api/v1/auth/login", json={"username": "legacy", "password": "old-password"}
    )
    assert login.status_code == 200
    profile = client.get(PROFILE, headers=bearer(login)).json()["data"]
    assert profile["user_id"] == registered.json()["data"]["id"]
    assert profile["nickname"] is None
    assert "timezone" not in profile


@pytest.mark.parametrize(
    "payload",
    [
        {"code": "   "},
        {"code": "x" * 257},
        {"code": "safe-code", "openid": "forged-owner"},
        {"code": "safe-code", "owner_id": 123},
        {"code": "safe-code", "timezone": "UTC"},
        {"code": {"private": "secret-code"}},
    ],
)
def test_invalid_exchange_input_does_not_leak_or_create(
    client, db_session, exchange, caplog, payload
):
    result = client.post(WECHAT, json=payload)
    assert result.status_code == 422
    assert not exchange.codes
    assert count(db_session, User) == 0
    assert "secret-code" not in result.text + caplog.text


def test_exchange_failure_is_safe_and_creates_no_account(
    client, db_session, exchange, monkeypatch, caplog
):
    def fail(code):
        raise WechatDependencyUnavailable()

    monkeypatch.setattr(exchange, "exchange", fail)
    result = client.post(WECHAT, json={"code": "private-code"})
    assert result.status_code == 503
    assert count(db_session, User) == count(db_session, WechatIdentity) == 0
    assert "private-code" not in result.text + caplog.text


def test_redis_outage_refuses_wechat_login_before_exchange(
    client, db_session, exchange, monkeypatch
):
    def fail():
        raise RedisError("private redis connection")

    monkeypatch.setattr(auth_redis_service.redis_client, "ping", fail)
    result = client.post(WECHAT, json={"code": "unused-code"})
    assert result.status_code == 503
    assert result.json()["code"] == 50301
    assert not exchange.codes
    assert count(db_session, User) == 0


def test_exchange_precedes_transaction_and_creation_rolls_back(db_session, monkeypatch):
    exchange = StubExchange()

    def exchange_outside_transaction(code):
        assert not db_session.in_transaction()
        return exchange.identity

    monkeypatch.setattr(exchange, "exchange", exchange_outside_transaction)
    profile_repo = ProfileRepository(db_session)

    def fail_profile(user_id):
        raise RuntimeError("profile write failed")

    monkeypatch.setattr(profile_repo, "create", fail_profile)
    service = WechatAuthService(
        UserRepository(db_session),
        WechatIdentityRepository(db_session),
        profile_repo,
        exchange,
    )
    with pytest.raises(RuntimeError, match="profile write failed"):
        service.login("one-time-code")
    assert count(db_session, User) == count(db_session, WechatIdentity) == 0
    assert count(db_session, UserProfile) == 0


def test_existing_identity_race_rolls_back_only_losing_account(db_session, monkeypatch):
    exchange = StubExchange()
    identity_repo = WechatIdentityRepository(db_session)
    service = WechatAuthService(
        UserRepository(db_session),
        identity_repo,
        ProfileRepository(db_session),
        exchange,
    )
    token, user = service.login("first-code")
    winner_id = user.id
    original_read = identity_repo.get_user
    reads = 0

    def raced_read(app_id, open_id):
        nonlocal reads
        reads += 1
        return None if reads == 1 else original_read(app_id, open_id)

    monkeypatch.setattr(identity_repo, "get_user", raced_read)
    another_token, winner = service.login("fresh-code")
    assert winner.id == winner_id
    assert decode_access_token(token)["sub"] == str(winner_id)
    assert decode_access_token(another_token)["sub"] == str(winner_id)
    assert count(db_session, User) == count(db_session, WechatIdentity) == 1
    assert count(db_session, UserProfile) == 1


def test_unrelated_integrity_error_is_not_masked_by_a_concurrent_identity(
    db_session, monkeypatch
):
    exchange = StubExchange()
    user_repo = UserRepository(db_session)
    identity_repo = WechatIdentityRepository(db_session)
    service = WechatAuthService(
        user_repo, identity_repo, ProfileRepository(db_session), exchange
    )
    _, winner = service.login("first-code")
    winner_id = winner.id
    original_read = identity_repo.get_user
    reads = 0

    def raced_read(app_id, open_id):
        nonlocal reads
        reads += 1
        return None if reads == 1 else original_read(app_id, open_id)

    error = IntegrityError(
        "injected unrelated unique failure",
        {},
        SQLiteIntegrityError("UNIQUE constraint failed: users.username"),
    )

    def fail_create(*args, **kwargs):
        raise error

    monkeypatch.setattr(identity_repo, "get_user", raced_read)
    monkeypatch.setattr(user_repo, "create", fail_create)
    with pytest.raises(IntegrityError) as result:
        service.login("fresh-code")
    assert result.value is error
    assert (
        original_read(exchange.identity.app_id, exchange.identity.open_id).id
        == winner_id
    )


@pytest.mark.parametrize(
    "body,expected_error",
    [
        (b"not-json-with-private-session", WechatDependencyUnavailable),
        (b"{}", WechatDependencyUnavailable),
        (b"[]", WechatDependencyUnavailable),
        (b'{"openid":"   "}', WechatDependencyUnavailable),
        (b'{"openid":17}', WechatDependencyUnavailable),
        (
            b'{"errcode":-1,"errmsg":"private-provider-details"}',
            WechatDependencyUnavailable,
        ),
        (
            b'{"errcode":40029,"errmsg":"private-provider-details"}',
            WechatLoginFailedException,
        ),
        (b'{"errcode":40163}', WechatLoginFailedException),
        (b"x" * 16_385, WechatDependencyUnavailable),
    ],
)
def test_exchange_response_errors_are_controlled(monkeypatch, body, expected_error):
    monkeypatch.setattr(wechat_service, "_open_request", lambda *a, **kw: BytesIO(body))
    with pytest.raises(expected_error) as error:
        HttpWechatCodeExchange("app", "private-secret", 2).exchange("private-code")
    assert "private" not in str(error.value)


@pytest.mark.parametrize(
    "error", [TimeoutError("private-code"), URLError("private-secret")]
)
def test_exchange_network_errors_are_controlled(monkeypatch, error):
    def fail(*args, **kwargs):
        raise error

    monkeypatch.setattr(wechat_service, "_open_request", fail)
    with pytest.raises(WechatDependencyUnavailable) as result:
        HttpWechatCodeExchange("app", "private-secret", 2).exchange("private-code")
    assert "private" not in str(result.value)


def test_exchange_sends_bounded_request_and_discards_session_secrets(monkeypatch):
    calls = []

    def respond(request, timeout):
        calls.append((request, timeout))
        return BytesIO(
            json.dumps(
                {
                    "openid": "identity",
                    "session_key": "private-key",
                    "unionid": "ignored",
                }
            ).encode()
        )

    monkeypatch.setattr(wechat_service, "_open_request", respond)
    result = HttpWechatCodeExchange("app", "private-secret", 2).exchange("fresh-code")
    assert result == WechatAccountIdentity("app", "identity")
    assert len(calls) == 1
    assert calls[0][1] == 2
    assert "js_code=fresh-code" in calls[0][0].full_url
    assert "private-key" not in repr(result)


def test_missing_wechat_config_fails_without_network(monkeypatch):
    def must_not_call(*args, **kwargs):
        raise AssertionError("unexpected external call")

    monkeypatch.setattr(wechat_service, "_open_request", must_not_call)
    with pytest.raises(WechatDependencyUnavailable):
        HttpWechatCodeExchange(None, None, 2).exchange("code")
