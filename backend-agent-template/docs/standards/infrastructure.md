# Infrastructure

横切基础设施的职责与用法：配置、DB 会话 / 事务、Redis 缓存与容错、安全 / JWT、请求日志中间件。适用范围：`app/core/` 与 `app/services/` 中的 Redis 能力。
各层职责边界看 [layer-definition.md](./layer-definition.md)；响应 / 异常契约看 [api-and-error-contract.md](./api-and-error-contract.md)。

## 配置（core/config）

- 所有配置经 `Settings`（`pydantic-settings`，读 `.env`）；模块内 `from app.core.config import settings` 使用，不散读 `os.environ`。
- 必填项无默认值（`database_url`、`secret_key`），强制显式配置；选填项给默认（`algorithm="HS256"`、`access_token_expire_minutes=1440`、`redis_url`）。
- 密钥只走 `.env`，提供 `.env.example` 占位；新增配置项在 `Settings` 加字段，不在调用处硬编码。

## DB 会话与事务（core/session）

- 唯一的 `engine` 与 `SessionLocal` 在此定义；请求级会话由 `get_db` 生成器经 `Depends(get_db)` 注入，用完自动 `close`，异常自动 `rollback`。业务层不自建 engine / session。
- 写操作用 `transaction(db)` 上下文收口提交边界：

```python
from app.core.session import transaction

with transaction(db):
    ...写操作...          # 正常结束 → commit；抛异常 → rollback 并向外抛
```

- 把分散的 `try/commit/rollback` 收敛到一处；同一调用链保持单一 commit 点，不在 service 与 repository 各自 commit 造成边界冲突。

## Redis 客户端与容错（core/redis_client）

- 唯一的 `redis_client` 在此创建（`decode_responses=True`）；业务不另建连接。
- **容错降级是硬约定**：所有 Redis 操作用 `@redis_safe(default=...)` 包裹，故障（`RedisError`）时记 warning 并返回 `default`，**不向外抛、不阻断主流程**（fail-open）。

```python
@redis_safe(default=None)
def get_json(key: str) -> dict | None:
    ...
```

- 降级方向要安全：缓存读失败返回 `None`（回源查库）；黑名单查失败返回 `False`（token 签名本身已验证，优先保可用）；限流计数失败返回 `0`（本次不锁定）。新增 Redis 能力时按此原则选 `default`。

## 缓存与认证 Redis 能力（services）

- 通用缓存在 `services/cache_service.py`：`get_json`/`set_json`/`delete_key` + 用户缓存（key 前缀 `user:`，默认 300s）。key 用带前缀的常量函数生成，不在调用处拼字符串。
- 认证相关 Redis 能力在 `services/auth_redis_service.py`：
  - **登录失败限流**：`record_login_failure` 计数 + 首次失败设过期；达 `MAX_LOGIN_FAILURES` 由 service 抛 `LoginLockedException`。
  - **JWT 黑名单**：登出时 `blacklist_token(jti, ttl)` 按 token 剩余有效期写入；`get_current_user` 用 `is_token_blacklisted(jti)` 校验。
- 用户信息变更时调 `delete_user_cache` 主动失效，避免脏缓存。

## 安全 / JWT（core/security）

- 密码用 `bcrypt`（`hash_password`/`verify_password`），不存明文、不用可逆加密。
- JWT 用 `python-jose`：`create_access_token(subject)` 签发（带 `sub`/`exp`/`iat`/`jti`），`decode_access_token` 校验，`get_token_ttl_seconds(payload)` 算剩余有效期（供黑名单 TTL）。
- 算法 / 密钥 / 有效期只从 `settings` 取；`jti` 是登出黑名单的关键，签发时必带。

## 请求日志中间件（core/middlewares）

- `request_log_middleware` 为每个请求注入 / 透传 `X-Request-ID`（存 `request.state.request_id`，回写响应头），记录 `method/path/status_code/duration_ms`。
- 全局 exception handler 从 `request.state.request_id` 取同一 id 记错误日志，实现请求-错误链路可追踪；新增 handler 时沿用 `get_request_id(request)`。
- 中间件在 `main.py` 经 `app.middleware("http")(request_log_middleware)` 注册；日志格式统一在 `core/logging.setup_logging` 配置。

## 装配入口（main.py）

- `main.py` 负责：`setup_logging()` → 建 `FastAPI` 实例 → 注册中间件 → `add_exception_handler` 注册四个 handler（Business / Validation / HTTP / 兜底 Exception）→ `include_router(prefix="/api/v1")` → `/health`。
- 新增：路由在此 `include_router`；新异常类型在 `core/exceptions` 加子类（handler 已按基类 `BusinessException` 统一捕获，无需逐个注册）。
