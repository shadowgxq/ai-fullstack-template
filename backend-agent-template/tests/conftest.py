"""
pytest 的共享配置文件。

conftest.py 是 pytest 的"魔法文件"：放在这里的 fixture（测试夹具）会被同目录
及子目录下所有测试**自动发现**，测试函数只要把 fixture 名字写成参数，pytest
就会自动调用并把返回值注入进来——这套机制本身就是"依赖注入"，和 FastAPI 的
Depends() 思路一模一样。

前端类比：类似 Jest 的 setup 文件 + 自定义 test fixtures，但 Python 这套是
靠"函数参数名"匹配的，不用手动 import。
"""

import os

# 必须在 import app（触发 config.Settings() 实例化）之前先兜底必要的环境变量。
# Settings 在被 import 时就会实例化（读 .env），缺了必填项会直接报错。
# setdefault：本机有 .env 就用 .env 的；CI / 模板无 .env 的环境用这里的占位值，
# 保证测试不依赖任何外部文件或服务即可运行。
#
# 占位值用合法的 Postgres 连接串（而不是 sqlite://）：Settings 校验时只认
# 一个非空字符串，create_engine 又是惰性的（创建 engine 对象时并不真连库），
# 所以这串假地址不会报错。真正的请求会被下面的 dependency_overrides 引到内存
# SQLite，根本不碰这个地址。
os.environ.setdefault(
    "DATABASE_URL", "postgresql+psycopg2://test:test@localhost:5432/test"
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-only-for-tests")

from main import app
from app.core.session import get_db
from app.core import redis_client as redis_module
from app.core.base import Base
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from fastapi.testclient import TestClient
import pytest


# 必须 import 一次 models，模型类才会注册到 Base.metadata，
# 否则下面 create_all 建不出表。import 即"登记"，不是为了直接用它们。
from app.models import user as _user  # noqa: F401


class FakeRedis:
    """极简内存版 Redis：只实现项目用到的几个命令，数据存普通 dict。

    为什么需要它：真 Redis 没起时，每次调用要等 5 秒 socket 超时才抛错（虽然
    redis_safe 会接住降级，但几十个测试累加就把测试拖死了）。测试本就不该依赖
    外部服务——用内存假对象替换，既快又可预测，还能真实地累加失败计数。

    decode_responses=True 的真客户端返回 str，这里也尽量贴近该行为。
    """

    def __init__(self):
        self.store: dict[str, str] = {}

    def get(self, key):
        return self.store.get(key)

    def set(self, key, value, ex=None):
        self.store[key] = value

    def incr(self, key):
        self.store[key] = str(int(self.store.get(key, 0)) + 1)
        return int(self.store[key])

    def expire(self, key, seconds):
        pass  # 内存版不做真正过期，测试用不到

    def delete(self, key):
        self.store.pop(key, None)

    def exists(self, key):
        return 1 if key in self.store else 0


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch):
    """autouse=True：每个测试自动启用，无需在参数里写。

    把共享的 redis_client 实例换成 FakeRedis——所有模块都是
    `from app.core.redis_client import redis_client` 引用同一个对象，
    在源头替换，cache_service / auth_redis_service 全都用上内存版。
    monkeypatch 会在测试结束后自动还原。
    """
    fake = FakeRedis()
    monkeypatch.setattr(redis_module, "redis_client", fake)
    # 这些模块在 import 时已经把 redis_client 绑成自己的模块属性，逐个替换
    import app.services.auth_redis_service as ars
    import app.services.cache_service as cs

    monkeypatch.setattr(ars, "redis_client", fake)
    monkeypatch.setattr(cs, "redis_client", fake)
    return fake


@pytest.fixture
def db_session():
    """每个测试一份全新的、内存里的 SQLite 数据库。

    - "sqlite://" 是纯内存库：不落磁盘，进程结束就没了，天然隔离、飞快。
    - StaticPool + check_same_thread=False：让 TestClient（同步请求）和测试代码
      共用同一条连接，否则内存库会"各连各的"看不到对方建的表。
    - yield 之前是"准备"（建表），yield 之后是"清理"（删表）——又是上下文管理器那套。
      每个用例跑完都把表 drop 掉，保证用例之间互不污染。
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture
def client(db_session):
    """带"测试数据库"的 HTTP 客户端。

    关键是 app.dependency_overrides：FastAPI 允许在测试里"偷梁换柱"，
    把生产用的 get_db（连 Postgres）替换成返回测试 SQLite session 的版本。
    这样请求照常走真实的路由/依赖/service，只是底层数据库换成了内存库。
    用完 clear() 还原，避免影响别的测试。

    注意这个 fixture 把 db_session 写成参数 —— 于是它自动依赖上面那个 fixture，
    pytest 会先建好 db_session 再建 client。fixture 之间也能"依赖注入"。
    """

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
