# File Organization

模块 / 文件命名和放置规则。适用范围：`app/`（FastAPI + SQLAlchemy 2.0 同步，Python ≥ 3.10）。
各层怎么写、数据边界看 [layer-definition.md](./layer-definition.md)；依赖方向看 [../architecture/technology-baseline.md](../architecture/technology-baseline.md)。

## 文件 / 标识符命名

| 类型 | 约定 | 示例 |
|---|---|---|
| 模块 / 包 | snake_case | `user_repository.py`、`api/v1/` |
| 函数 / 变量 | snake_case | `get_current_user`、`access_token` |
| 类（Model/Schema/异常） | PascalCase | `User`、`LoginRequest`、`BusinessException` |
| 常量 | UPPER_SNAKE_CASE | `MAX_LOGIN_FAILURES`、`USER_CACHE_PREFIX` |
| 模块私有 | 前缀 `_` | `_task`、`_weight` |
| 数据库表 | snake_case 复数 | `users` |
| schema 类型 | `域名 + 用途` | `RegisterRequest`、`TokenResponse`、`CurrentUserResponse` |

## 放置规则（按层）

| 场景 | 放置位置 | 示例 |
|---|---|---|
| HTTP 路由（按资源域一文件） | `app/api/v1/<域>.py` | `api/v1/auth.py` |
| 业务编排 / 规则 | `app/services/<域>_service.py` | `services/auth_service.py` |
| Redis 相关业务能力 | `app/services/<域>_redis_service.py` 或 `cache_service.py` | `services/auth_redis_service.py` |
| 数据访问（ORM 查询类） | `app/repositories/<域>_repository.py` | `repositories/user_repository.py` |
| ORM 表模型 | `app/models/<域>.py` | `models/user.py` |
| 出入参 schema | `app/schemas/<域>.py` | `schemas/auth.py` |
| 通用 schema（响应） | `app/schemas/response.py` | `ApiResponse`、`success_response` |
| 配置 / 会话 / 安全 / 依赖 / Redis / 异常 / 日志 / 中间件 | `app/core/<关注点>.py` | `core/config.py`、`core/deps.py`、`core/redis_client.py` |
| 数据库迁移 | `alembic/versions/` | 由 `alembic revision --autogenerate` 生成 |
| 测试 | `tests/test_<目标>.py` | `tests/test_auth_api.py` |

## 模块组织

- 一个资源域在每层各对应一个模块（`user` → `api/v1/auth.py` + `services/auth_service.py` + `repositories/user_repository.py` + `models/user.py` + `schemas/auth.py`），按层归类而非按功能打包成巨型文件。
- 模块过大（多职责混杂）时按子域拆分模块，不靠堆函数；拆分仍遵守分层，不跨层塞进同一文件。
- `__init__.py` 只做包聚合，不放业务逻辑；新增路由模块后在 `main.py` 用 `include_router` 注册（或在 `api/v1/__init__.py` 汇总后统一注册）。
- 新增资源域时优先复用既有层与模式，不为单个接口新造平行目录结构。

## 放置判断

- 先问「这段代码属于哪一层职责」（收请求 / 编排规则 / 访问数据 / 表结构 / 契约 / 横切），再放对应目录，不按「文件看起来该在哪」随手放。
- 业务规则只进 `services`；纯 ORM 查询进 `repositories`；可跨路由复用的依赖（如 `get_current_user`）进 `core/deps`；与具体域无关的横切能力（配置、Redis、异常、日志、中间件）进 `core`。
- 同一逻辑被多个域复用且无业务语义（纯工具）时，再考虑提取到 `core`，不为一次性复用提前抽象。
