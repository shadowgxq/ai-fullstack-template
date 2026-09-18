"""Required login throttling and token revocation; never fail open."""

from app.core.redis_client import redis_client, redis_required

LOGIN_FAIL_PREFIX = "login:fail:"
MAX_LOGIN_FAILURES = 5
LOGIN_LOCK_SECONDS = 10 * 60
TOKEN_BLACKLIST_PREFIX = "jwt:blacklist:"


def get_login_fail_key(username: str) -> str:
    return f"{LOGIN_FAIL_PREFIX}{username}"


@redis_required
def get_login_fail_count(username: str) -> int:
    value = redis_client.get(get_login_fail_key(username))
    return int(value) if value is not None else 0


def is_login_locked(username: str) -> bool:
    return get_login_fail_count(username) >= MAX_LOGIN_FAILURES


@redis_required
def record_login_failure(username: str) -> int:
    # Atomic counter + initial expiry; repeated failures do not extend the window.
    key = get_login_fail_key(username)
    with redis_client.pipeline(transaction=True) as pipeline:
        pipeline.incr(key)
        pipeline.expire(key, LOGIN_LOCK_SECONDS, nx=True)
        count, _ = pipeline.execute()
    return int(count)


@redis_required
def clear_login_failure(username: str) -> None:
    redis_client.delete(get_login_fail_key(username))


def get_token_blacklist_key(jti: str) -> str:
    return f"{TOKEN_BLACKLIST_PREFIX}{jti}"


@redis_required
def blacklist_token(jti: str, ttl_seconds: int) -> None:
    if ttl_seconds > 0:
        redis_client.set(get_token_blacklist_key(jti), "1", ex=ttl_seconds)


@redis_required
def is_token_blacklisted(jti: str) -> bool:
    return redis_client.exists(get_token_blacklist_key(jti)) == 1
