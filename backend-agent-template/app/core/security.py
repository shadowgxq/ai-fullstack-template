from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
from jose import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid4()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def get_token_ttl_seconds(payload: dict) -> int:
    """根据 payload 的 exp 计算 token 剩余有效期（秒），已过期返回 0。"""
    exp = payload.get("exp")
    if exp is None:
        return 0
    now = datetime.now(timezone.utc).timestamp()
    return max(int(exp - now), 0)
