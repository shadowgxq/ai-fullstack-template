import functools
import logging

import redis
from redis.exceptions import RedisError

from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = redis.Redis.from_url(
    settings.redis_url,
    decode_responses=True,
)


def redis_safe(default=None):
    """Redis 容错装饰器：操作失败时记录告警并返回 default（降级），不向外抛异常。

    三层结构（带参数的装饰器都是这个形状）：
      第 1 层 redis_safe(default=...)  —— 接收装饰器参数，返回真正的装饰器
      第 2 层 decorator(func)          —— 接收被装饰函数，返回替身
      第 3 层 wrapper(*args, **kwargs) —— 真正执行：try 包住原函数，失败返回 default
    """

    def decorator(func):
        @functools.wraps(
            func
        )  # 保留原函数的 __name__/__doc__，否则日志里全是 "wrapper"
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except RedisError as e:
                logger.warning("Redis 操作降级 %s: %s", func.__name__, e)
                return default

        return wrapper

    return decorator
