# 技术基线与架构边界

> 记录 `app/` 的技术选型、分层、依赖方向和数据流边界。具体命名 / 编码细则见 [standards/](../standards/python-development.md)。

## 技术基线

| 领域 | 选型 | 说明 |
|---|---|---|
| 框架 | FastAPI | OpenAPI（`/docs`）即接口事实源；路由为**同步 `def`** |
| 语言 | Python ≥ 3.10 | 用 PEP 604 `X \| None`；不追求 mypy strict，以 ruff 静态检查为准 |
| ORM | SQLAlchemy 2.0（**同步**） | `Mapped` / `mapped_column` 声明式；驱动 psycopg2；会话用 `Session` |
| 校验 / 序列化 | Pydantic v2 + pydantic-settings | 出入参 schema；配置从 `.env` 读取 |
| 数据库 | PostgreSQL | 可筛字段建列 + 索引 |
| 缓存 / 限流 | Redis | `redis_safe` 容错降级；缓存、登录失败限流、JWT 黑名单 |
| 迁移 | Alembic | 改表必须留迁移，禁止手改表不留记录 |
| 认证 | python-jose(JWT) + bcrypt | 自签 JWT（带 `jti`）；登出走 Redis 黑名单 |
| 包管理 | uv（`pyproject.toml` + `uv.lock`） | `uv sync` / `uv run`，不混用 pip/poetry |
| 校验工具 | `ruff check` + `ruff format` + `pytest` | 经 `make lint` / `make test` 执行 |

> 不引入 ORM 之外的查询构建器、不引入重型 DI 框架（用 FastAPI `Depends`）；配置读取只走 `core/config.Settings`，不散读 `os.environ`。新依赖先评估是否进 `pyproject.toml` 并 `uv lock`。
>
> **同步基线说明**：本模板 IO 路径为同步（`Session` + psycopg2）。若某项目确需 async，须整体切换（`AsyncSession` + asyncpg + `async def`），不在同一代码库混用同步与异步 DB 驱动。

## `app/` 目录分层

```text
app/
├── api/v1/          # 版本化路由：auth（__init__ 预留聚合位）
├── services/        # 业务编排（规则 + 调 repository + 拼装出参）
├── repositories/    # 数据访问层（封装 ORM 查询/写入的类，不含业务规则）
├── models/          # SQLAlchemy ORM（表结构）
├── schemas/         # Pydantic 出入参（response.py 放 ApiResponse/success_response）
└── core/            # 横切基础设施：
                     #   config（settings）/ session（engine+get_db+transaction）
                     #   security（JWT+bcrypt）/ deps（get_current_user）
                     #   redis_client（redis_safe）/ exceptions（BusinessException）
                     #   exception_handlers / logging / middlewares（请求日志）
main.py              # FastAPI 实例、中间件、统一异常处理、/health、路由注册
```

分层职责与各层写法见 [standards/layer-definition.md](../standards/layer-definition.md)；新代码放哪一层见 [standards/file-organization.md](../standards/file-organization.md)。

## 依赖方向

```text
api  →  services  →  repositories  →  models
 │         │              │
 └── schemas / deps        └── core（config/session/security/redis/exceptions）
```

- **依赖只向下、不反向、不跨级**：`repositories` 不调 `services`，`services` 不 import `api`。
- `schemas` 与 `core` 为横切：被各层依赖，自身不依赖业务层。
- 各层职责、函数签名与跨层禁止项以 [standards/layer-definition.md](../standards/layer-definition.md) 为 owner，此处不重复。

## 数据流边界

```text
HTTP 请求 → api/v1 路由（校验入参）→ service 业务方法 → repository 查询 → models/DB
         ← ApiResponse[T] 包装      ← schema 出参拼装   ← ORM 对象
```

- 请求级 `Session` 由 `core/session.get_db` 经 `Depends` 注入；路由 / service 不自建 engine、不自管连接。写操作用 `with transaction(db):` 收口单一 commit 点（见 [standards/infrastructure.md](../standards/infrastructure.md)）。
- 业务错误用 `core/exceptions.BusinessException`（及子类）抛出，由 `main.py` 的 exception handler 统一转 `{code,message,data}`；各层不自己拼错误响应。
- Redis 相关能力（缓存、限流、黑名单）在 `core/redis_client` + `services/*_redis_service` / `cache_service` 收口，故障时 `redis_safe` 降级，不阻断主流程、不散落到路由。
