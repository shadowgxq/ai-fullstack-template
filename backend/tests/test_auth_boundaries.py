"""Regressions for credentials, safe error contracts and transaction ownership."""

from datetime import datetime, timedelta, timezone
import pytest
from jose import jwt
from sqlalchemy import select
from app.core.config import settings
from app.core.exceptions import UsernameAlreadyExistsException
from app.core.session import transaction
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService


@pytest.mark.parametrize(
    "update",
    [
        {"sub": "not-a-user-id"},
        {"sub": "999999999999999999999"},
        {"sub": "0"},
        {"jti": None},
        {"exp": None},
    ],
)
def test_invalid_signed_claims_are_401_not_500(client, update):
    payload = {
        "sub": "1",
        "jti": "test-id",
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=1)).timestamp()),
    }
    payload.update(update)
    if payload.get("exp") is None:
        payload.pop("exp")
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    response = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


def test_missing_credentials_challenge_and_openapi(client):
    assert client.get("/api/v1/auth/me").headers["WWW-Authenticate"] == "Bearer"
    schema = client.get("/openapi.json").json()
    schemes = schema["components"]["securitySchemes"].values()
    assert all(s["type"] == "http" and s["scheme"] == "bearer" for s in schemes)
    assert "503" in schema["paths"]["/api/v1/auth/login"]["post"]["responses"]


@pytest.mark.parametrize(
    "body",
    [
        {"username": "   ", "password": "private-password"},
        {"username": "a" * 51, "password": "private-password"},
        {"username": "u", "password": "私" * 25},
        {"username": "u", "password": {"secret": "private-password"}},
    ],
)
def test_invalid_credentials_are_safe_field_errors(client, caplog, body):
    response = client.post("/api/v1/auth/register", json=body)
    assert response.status_code == 422
    assert response.json()["code"] == 42200
    assert all(set(e) == {"loc", "type", "msg"} for e in response.json()["data"])
    assert "private-password" not in response.text + caplog.text
    assert "私" * 25 not in response.text + caplog.text


def test_username_identity_and_utf8_password_boundary(client):
    password = "私" * 24  # exactly 72 UTF-8 bytes
    response = client.post(
        "/api/v1/auth/register", json={"username": " trim ", "password": password}
    )
    assert response.status_code == 200
    assert response.json()["data"]["username"] == " trim "
    assert (
        client.post(
            "/api/v1/auth/login", json={"username": " trim ", "password": password}
        ).status_code
        == 200
    )


def test_repository_does_not_commit_outer_transaction(db_session):
    repo = UserRepository(db_session)
    with pytest.raises(RuntimeError):
        with transaction(db_session):
            repo.create("rollback-me", "not-a-real-hash")
            raise RuntimeError("later operation failed")
    assert db_session.scalar(select(User).where(User.username == "rollback-me")) is None


def test_service_commits_registration_and_handles_unique_race(db_session, monkeypatch):
    repo = UserRepository(db_session)
    service = AuthService(repo)
    service.register("race", "password")
    db_session.rollback()
    assert repo.get_by_username("race") is not None
    original = repo.get_by_username
    reads = 0

    def racing_read(username):
        nonlocal reads
        reads += 1
        return None if reads == 1 else original(username)

    monkeypatch.setattr(repo, "get_by_username", racing_read)
    with pytest.raises(UsernameAlreadyExistsException):
        service.register("race", "password")
    assert original("race") is not None  # failed flush was rolled back


def test_unhandled_error_does_not_leak_in_middleware_or_response(
    client, monkeypatch, caplog
):
    def fail(*args):
        raise RuntimeError("SQL parameters: private-db-password")

    monkeypatch.setattr(UserRepository, "get_by_username", fail)
    response = client.post(
        "/api/v1/auth/register",
        json={"username": "u", "password": "private-body-password"},
        headers={"X-Request-ID": "bad id\ninvalid"},
    )
    assert response.status_code == 500
    assert response.json()["message"] == "Internal server error"
    assert "X-Request-ID" in response.headers
    assert "private-db-password" not in caplog.text + response.text
    assert "private-body-password" not in caplog.text + response.text
    assert "bad id" not in caplog.text
