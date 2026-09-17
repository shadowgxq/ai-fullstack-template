"""
验证 redis_safe 装饰器真的"挡住"了 Redis 故障。

测法：用 monkeypatch 把 fake_redis 的某个方法替换成"一调用就抛 RedisError"，
模拟 Redis 宕机，然后断言被 @redis_safe 装饰的函数返回的是降级值、而不是把
异常抛出来。这正是上一组测试搭好 fake_redis 之后能做的事。
"""

from redis.exceptions import RedisError

from app.services import auth_redis_service as ars
from app.services import cache_service as cs


def _raise(*args, **kwargs):
    """替身：模拟 Redis 操作失败。"""
    raise RedisError("simulated redis down")


# ---- 正常路径：装饰器不能破坏原有功能 ----


def test_record_login_failure_increments_normally(fake_redis):
    # redis_safe 包了一层，但 Redis 正常时计数必须照常累加
    assert ars.record_login_failure("u") == 1
    assert ars.record_login_failure("u") == 2
    assert ars.get_login_fail_count("u") == 2


# ---- 故障路径：每个函数降级到它声明的 default ----


def test_get_login_fail_count_degrades_to_zero(fake_redis, monkeypatch):
    monkeypatch.setattr(fake_redis, "get", _raise)
    # @redis_safe(default=0)：Redis 挂时当作失败 0 次，绝不抛异常
    assert ars.get_login_fail_count("anyone") == 0


def test_is_login_locked_false_when_redis_down(fake_redis, monkeypatch):
    monkeypatch.setattr(fake_redis, "get", _raise)
    # 计数降级为 0 → 未达上限 → 不锁定。避免 Redis 一挂就误锁所有人
    assert ars.is_login_locked("anyone") is False


def test_is_token_blacklisted_fail_open(fake_redis, monkeypatch):
    monkeypatch.setattr(fake_redis, "exists", _raise)
    # @redis_safe(default=False)：查不了黑名单就当"没拉黑"，放行（fail-open）
    assert ars.is_token_blacklisted("some-jti") is False


def test_cache_get_json_degrades_to_none(fake_redis, monkeypatch):
    monkeypatch.setattr(fake_redis, "get", _raise)
    # default=None：调用方据此当"缓存未命中"，回源查数据库
    assert cs.get_json("any-key") is None


def test_cache_set_json_swallows_error(fake_redis, monkeypatch):
    monkeypatch.setattr(fake_redis, "set", _raise)
    # 写缓存失败必须静默：不返回值、更不能抛异常打断主流程
    assert cs.set_json("k", {"a": 1}) is None


# ---- 端到端：Redis 全挂时，登录仍然成功 ----


def test_login_still_works_when_redis_completely_down(client, fake_redis, monkeypatch):
    client.post(
        "/api/v1/auth/register",
        json={"username": "ezra", "password": "pw-123456"},
    )
    # 把 Redis 的每个命令都打瘫
    for method in ("get", "set", "incr", "expire", "delete", "exists"):
        monkeypatch.setattr(fake_redis, method, _raise)

    resp = client.post(
        "/api/v1/auth/login",
        json={"username": "ezra", "password": "pw-123456"},
    )

    # 失败计数/黑名单只是附属层，Redis 挂了不该拖垮核心登录
    assert resp.status_code == 200
    assert resp.json()["data"]["access_token"]
