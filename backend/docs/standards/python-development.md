# Python Development

日常后端实现入口。技术基线和分层看 [../architecture/technology-baseline.md](../architecture/technology-baseline.md)；分层职责、API 契约、基础设施细则看本目录其他文件。
适用范围：`app/`（FastAPI + SQLAlchemy 2.0 同步 + Pydantic v2，Python ≥ 3.10）。

## 命名和类型注解

- 模块 / 函数 / 变量用 `snake_case`；类（Model/Schema/异常）用 `PascalCase`；常量 `UPPER_SNAKE_CASE`（`MAX_LOGIN_FAILURES`、`ACCESS_TOKEN_EXPIRE_MINUTES`）。
- 命名表达业务含义，避免 `data`、`info`、`tmp`、`obj`；集合用复数（`users`、`tasks`），映射用语义后缀（`user_by_id`）。
- 公开函数签名显式标注参数与返回类型；用 PEP 604 `User | None`，不用 `Optional[...]`/`Union[...]`。
- 不用裸 `Any` 兜底；动态结构（如缓存 JSON）用 `dict | None` 并在 service 边界转成 schema。
- 每个模块用一句简短中文注释 / docstring 说明职责（沿用现有风格）；公开函数按需补 docstring，不为 getter 凑字数。

## Pydantic 与 SQLAlchemy 风格

- 出入参用 Pydantic v2 `BaseModel`，字段 `snake_case`；按用途分型：入参（`XxxRequest`/`XxxQuery`）、出参（`XxxResponse`）分开，不一个模型走天下。
- 通用响应结构（`ApiResponse[T]`、`success_response`）集中在 `schemas/response.py`，不在各域重复定义；泛型用 PEP 695（`class ApiResponse[T]`）或既有 `TypeVar` 风格，保持与现有文件一致。
- ORM 用 2.0 声明式 `Mapped[...]` + `mapped_column(...)`；可空列标 `Mapped[str | None]`，唯一/可筛字段加 `unique=True`/`index=True`。
- 查询在 `repositories` 层用 `self.db.query(Model).filter(...)`（沿用现有仓储风格）；不在 service/api 里直接查 ORM、不裸拼 SQL 字符串。

## 同步 IO

- 路由、service、repository 都是**同步 `def`**；DB 走注入的 `Session`，不写 `async def`、不 `await`。
- 会话由 `core/session.get_db` 经 `Depends` 注入，函数内不自建 engine / session（见 [infrastructure.md](./infrastructure.md)）。
- 写操作用 `with transaction(db):` 包裹，统一 commit / rollback 边界，不在多处散写 `db.commit()`。

## 异常与日志

- 业务错误抛 `core/exceptions.BusinessException` 及子类（`TokenRevokedException`/`LoginFailedException` 等），由 `main.py` 注册的 handler 统一转响应；**不在 service/repository 里返回错误字典或裸抛 `HTTPException`**（契约细则见 [api-and-error-contract.md](./api-and-error-contract.md)）。
- 不吞异常（`except: pass`）；只捕获能处理的具体异常（如 `JWTError`、`RedisError`），其余交给全局兜底 handler。
- 日志走 `core/logging` 配置的 logger（`logging.getLogger(__name__)`），不用 `print`；不记敏感信息（token 明文、密码、密钥）。

## Import 与依赖

- 用绝对导入 `from app.xxx import ...`，不写包外相对导入；import 顺序交给 ruff isort（`I`）自动整理。
- 依赖方向只能向下（`api→services→repositories→models`），不反向、不跨级 import（见 [../architecture/technology-baseline.md](../architecture/technology-baseline.md)）。
- 新增第三方依赖先评估必要性，加进 `pyproject.toml` 并 `uv lock`；不在代码里临时 `pip install`。

## 配置

- 所有配置经 `core/config.Settings`（`pydantic-settings`）从环境变量 / `.env` 读取，模块内 `from app.core.config import settings` 使用，不散读 `os.environ`。
- 密钥（`secret_key`、DB 密码）只走 `.env`，提供 `.env.example`；不硬编码、不入库、不进 Git。

## 验证

> 当前验证手段：`make lint`（`ruff check --fix .` + `ruff format .`）+ `make test`（`pytest`）。改动后按下表自查。

- 任意改动：跑 `make lint`，保持 ruff 通过。
- 业务逻辑（service）改动：补 / 跑 `make test`，核心 service 分支（如登录限流、黑名单）必测。
- 模型 / 表结构改动：`make migrate m="..."` 生成 Alembic 迁移并 `make upgrade` 验证。
- 测试基座见 `tests/conftest.py`：用内存 SQLite + `FakeRedis`，测试不依赖外部服务；新增 model 后在 `conftest` / `alembic/env.py` 追加 import 使其注册到 `Base.metadata`。
