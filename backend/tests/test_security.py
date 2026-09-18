"""
纯函数测试：不碰数据库、不碰网络，只验证 security.py 里的工具函数。
这是 pytest 最简单的形态——给输入、断言输出，适合入门。
"""

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_password_hash_is_not_plaintext_and_verifies():
    h = hash_password("s3cret-pw")

    # 1. 存进库的是哈希，绝不是明文
    assert h != "s3cret-pw"
    # 2. 正确密码校验通过
    assert verify_password("s3cret-pw", h) is True
    # 3. 错误密码校验失败
    assert verify_password("wrong-pw", h) is False


def test_same_password_hashes_differ_due_to_salt():
    # bcrypt 每次加随机盐，所以同一个密码两次哈希结果不同——这是好事，
    # 防止"相同密码→相同哈希"被彩虹表反查。
    assert hash_password("same") != hash_password("same")


def test_token_roundtrip_carries_subject_and_jti():
    token = create_access_token(subject="42")
    payload = decode_access_token(token)

    assert payload["sub"] == "42"  # 签发时放进去的用户 id 能原样取回
    assert "jti" in payload  # 每个 token 有唯一 id，登出拉黑名单时用它
    assert "exp" in payload  # 过期时间


def test_each_token_has_unique_jti():
    # 两次签发的 jti 不同——黑名单按 jti 精确拉黑单个 token，不会误伤别的。
    p1 = decode_access_token(create_access_token(subject="1"))
    p2 = decode_access_token(create_access_token(subject="1"))
    assert p1["jti"] != p2["jti"]


def test_revocation_ttl_rounds_up(monkeypatch):
    from app.core import security

    class Clock:
        @staticmethod
        def now(tz):
            from datetime import datetime

            return datetime.fromtimestamp(100.2, tz)

    monkeypatch.setattr(security, "datetime", Clock)
    assert security.get_token_ttl_seconds({"exp": 101}) == 1
    assert security.get_token_ttl_seconds({"exp": 100}) == 0
