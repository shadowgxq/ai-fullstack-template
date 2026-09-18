from datetime import datetime, timedelta, timezone
from uuid import uuid4
import math

import bcrypt
from jose import JWTError, jwt

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
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    if not isinstance(payload.get("sub"), str) or not payload["sub"]:
        raise JWTError("Missing subject")
    if not isinstance(payload.get("jti"), str) or not 1 <= len(payload["jti"]) <= 128:
        raise JWTError("Missing token identity")
    exp = payload.get("exp")
    if (
        isinstance(exp, bool)
        or not isinstance(exp, (int, float))
        or not math.isfinite(exp)
    ):
        raise JWTError("Missing expiration")
    return payload


def get_token_ttl_seconds(payload: dict) -> int:
    """根据 payload 的 exp 计算 token 剩余有效期（秒），已过期返回 0。"""
    exp = payload.get("exp")
    if exp is None:
        return 0
    now = datetime.now(timezone.utc).timestamp()
    return max(math.ceil(exp - now), 0)
