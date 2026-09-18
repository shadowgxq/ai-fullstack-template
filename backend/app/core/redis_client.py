"""Separate optional caching from required security dependency policies."""

import functools
import logging
import redis
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.exceptions import AuthDependencyUnavailable

logger = logging.getLogger(__name__)
redis_client = redis.Redis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_connect_timeout=2,
    socket_timeout=2,
    retry_on_timeout=False,
)


def redis_safe(default=None):
    """Optional cache only: a Redis failure becomes an explicit cache miss."""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except RedisError as exc:
                logger.warning(
                    "cache_unavailable operation=%s type=%s",
                    func.__name__,
                    type(exc).__name__,
                )
                return default

        return wrapper

    return decorator


def redis_required(func):
    """Security facts must be available before authentication can succeed."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except RedisError as exc:
            logger.warning(
                "auth_dependency_unavailable operation=%s type=%s",
                func.__name__,
                type(exc).__name__,
            )
            raise AuthDependencyUnavailable() from None

    return wrapper
