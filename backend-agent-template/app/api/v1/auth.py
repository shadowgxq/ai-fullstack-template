from fastapi import APIRouter, Depends
from jose import JWTError

from app.core.deps import get_current_user, oauth2_scheme
from app.core.security import decode_access_token, get_token_ttl_seconds
from app.core.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    CurrentUserResponse,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
)
from app.schemas.response import ApiResponse, success_response
from app.services import auth_redis_service
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(db=Depends(get_db)) -> AuthService:
    return AuthService(UserRepository(db))


@router.post("/register", response_model=ApiResponse[CurrentUserResponse])
def register(
    payload: RegisterRequest,
    service: AuthService = Depends(get_auth_service),
):
    user = service.register(payload.username, payload.password)
    return success_response({"id": user.id, "username": user.username})


@router.post("/login", response_model=ApiResponse[TokenResponse])
def login(
    payload: LoginRequest,
    service: AuthService = Depends(get_auth_service),
):
    access_token = service.login(payload.username, payload.password)
    return success_response({"access_token": access_token, "token_type": "bearer"})


@router.get("/me", response_model=ApiResponse[CurrentUserResponse])
def get_me(current_user: User = Depends(get_current_user)):
    return success_response({"id": current_user.id, "username": current_user.username})


@router.post("/logout", response_model=ApiResponse[None])
def logout(token: str = Depends(oauth2_scheme)):
    # token 已失效/过期时 decode 会抛 JWTError；登出本就是要让它失效，
    # 因此幂等返回成功，而不是 500。
    try:
        payload = decode_access_token(token)
    except JWTError:
        return success_response()

    jti = payload.get("jti")
    if jti is not None:
        ttl_seconds = get_token_ttl_seconds(payload)
        auth_redis_service.blacklist_token(jti, ttl_seconds)
    return success_response()
