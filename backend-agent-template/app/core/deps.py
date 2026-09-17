from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.exceptions import TokenRevokedException
from app.core.security import decode_access_token
from app.core.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services import auth_redis_service
from app.services.cache_service import get_user_cache, set_user_cache

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        user_id = int(user_id)
    except JWTError:
        raise credentials_exception

    # token 已被加入黑名单（退出登录），直接拒绝。
    # is_token_blacklisted 内部已容错：Redis 故障时返回 False（fail-open）
    jti = payload.get("jti")
    if jti is not None and auth_redis_service.is_token_blacklisted(jti):
        raise TokenRevokedException()

    # 1. 先查 Redis 缓存（get_user_cache 内部已容错，故障时返回 None 自动回源）
    cached_user = get_user_cache(user_id)
    if cached_user:
        return User(
            id=cached_user["id"],
            username=cached_user["username"],
            password_hash="",
        )

    # 2. 缓存未命中或 Redis 不可用，查数据库
    repo = UserRepository(db)
    user = repo.get_by_id(user_id)
    if user is None:
        raise credentials_exception

    # 3. 写入缓存（set_user_cache 内部已容错，失败不影响主流程）
    set_user_cache(
        user_id=user.id,
        user_data={"id": user.id, "username": user.username},
    )

    return user
