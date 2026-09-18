"""HTTP authentication and request-scoped dependency composition."""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.exceptions import TokenRevokedException
from app.core.security import decode_access_token
from app.core.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services import auth_redis_service
from app.services.cache_service import get_user_cache, set_user_cache

bearer = HTTPBearer(auto_error=False)


def unauthorized() -> HTTPException:
    return HTTPException(
        401, "Could not validate credentials", headers={"WWW-Authenticate": "Bearer"}
    )


def get_access_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    if credentials is None:
        raise unauthorized()
    return credentials.credentials


def get_current_user(
    token: str = Depends(get_access_token), db: Session = Depends(get_db)
) -> User:
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
        # User.id is a PostgreSQL INTEGER, not an arbitrary JWT subject.
        if not 0 < user_id <= 2_147_483_647:
            raise ValueError("Invalid user subject")
    except (JWTError, ValueError, TypeError, KeyError):
        raise unauthorized() from None

    if auth_redis_service.is_token_blacklisted(payload["jti"]):
        raise TokenRevokedException()
    cached_user = get_user_cache(user_id)
    if cached_user:
        return User(
            id=cached_user["id"], username=cached_user["username"], password_hash=""
        )
    user = UserRepository(db).get_by_id(user_id)
    if user is None:
        raise unauthorized()
    set_user_cache(
        user_id=user.id, user_data={"id": user.id, "username": user.username}
    )
    return user
