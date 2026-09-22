# API 与错误契约

接口形状、统一响应、异常处理、状态码、鉴权的硬规则。适用范围：`app/`（FastAPI）。
各层怎么写看 [layer-definition.md](./layer-definition.md)；配置 / JWT / 中间件看 [infrastructure.md](./infrastructure.md)。

## RESTful 风格

- 统一前缀 `/api/v1`（在 `main.py` `include_router(prefix="/api/v1")`）；新版本接口开 `/api/v2` 并行，不破坏旧版。
- 资源用名词复数与动作子路径：`POST /auth/register`、`POST /auth/login`、`GET /auth/me`、`POST /auth/logout`。
- 方法语义：`GET` 查、`POST` 增 / 动作、`PUT`/`PATCH` 改、`DELETE` 删；查询过滤走 query 参数，不塞进路径。
- 路由按资源域分模块、各带 `tags`，OpenAPI（`/docs`）即接口事实源。

## 统一响应

业务 API 返回统一信封；`/health`、`/ready` 与 OpenAPI 为运维/协议例外：

```json
{ "code": 0, "message": "success", "data": { } }
```

- 成功 `code=0`；路由标 `response_model=ApiResponse[T]`，用 `success_response(data=...)` 返回，不手拼 dict。
- `ApiResponse[T]` 与 `success_response` 定义在 `schemas/response.py`；出参用 Pydantic `BaseModel`（snake_case），不返回裸 ORM 对象。
- 若需分页：在 `schemas/response.py` 增补 `Paginated[T]`（`list/total/page/page_size`）再包进 `ApiResponse`；分页逻辑放 service，不写进路由。（当前模板未内置分页，按需扩展。）

## 错误处理

- 业务错误抛 `core/exceptions.BusinessException` 及子类，由 `main.py` 注册的 exception handler 统一转 `{code,message,data:null}`。`BusinessException(code, message, status_code)` 三要素：业务 `code`、用户可读 `message`、HTTP `status_code`。

| 异常 | 业务 code（示例） | HTTP | 场景 |
|---|---|---|---|
| `BusinessException` | 自定义 | 自定义（默认 400） | 通用业务失败基类 |
| `UsernameAlreadyExistsException` | 40001 | 400 | 注册用户名已存在 |
| `LoginFailedException` | 40101 | 401 | 用户名或密码错误 |
| `TokenRevokedException` | 40102 | 401 | token 已登出（黑名单）|
| `LoginLockedException` | 42901 | 429 | 登录失败过多，暂时锁定 |
| `RequestValidationError` | 42200 | 422 | 入参校验失败（FastAPI 抛，统一兜底）|
| `StarletteHTTPException` | status×100 | 原状态码 | HTTP 异常兜底 |
| `AuthDependencyUnavailable` | 50301 | 503 | 安全依赖不可用，不能放行或宣称登出成功 |
| 未捕获 `Exception` | 50000 | 500 | 兜底，不泄露堆栈 |

- **不在路由 / service / repository 里裸抛 `HTTPException` 或返回错误字典**；统一走 `BusinessException`，新增错误类型补到 `core/exceptions`（分配一个业务 `code`）。
  - 例外：`api/dependencies` 的鉴权依赖沿用现有 `HTTPException(401)` 表达凭证无效，属框架依赖层惯例；业务层一律用 `BusinessException`。
- 错误 `message` 面向用户可读，不暴露内部细节、堆栈、SQL；全局 handler 会带上 `request_id` 记日志（见 [infrastructure.md](./infrastructure.md)）。

## 状态码与数据约定

- 用合适 HTTP 状态码（200/400/401/404/422/429/503/500）配合业务 `code`，不全用 200 裹错误。
- 时间/数量/时长/金额遵循 [公共数据语义](../../common/code-quality.md#变量与函数) 和提供方 schema；时间使用带时区 ISO 8601，布尔使用布尔。精确金额不为“全部数字”规则丢失既有序列化精度。
- 输入形状与范围就近声明：`Query(20, ge=1, le=50)`、Path 类型、Body schema；不要重复框架校验。资源权限、跨字段业务不变量仍在 Service 实际操作边界验证，不能仅依赖 schema。

## 鉴权

- 需登录的接口标注 `current_user = Depends(get_current_user)`（`api/dependencies`），从 `Authorization: Bearer <token>` 解析；失败抛 401 / `TokenRevokedException`。
- 登录签发 JWT（带 `jti`）；登出把 `jti` 加入 Redis 黑名单，`get_current_user` 校验黑名单。JWT 配置（`secret_key`/`algorithm`/有效期）只走 `settings`；token 不记日志、不入库。
- 登录失败限流、黑名单等细则见 [infrastructure.md](./infrastructure.md)。

## 契约变更

- 接口出入参变更同步更新对应 `schemas/`，并保证 `response_model` 与实际返回一致；`/docs` 是对外事实源。
- 新增接口后确认已在 `main.py`（或 `api/v1/__init__.py`）注册，接口实际可达。

422 的 `data` 是字段错误数组，每项只有 `loc/type/msg`，不得包含输入原文、密码或异常 ctx；前端错误归一化将该数组放入 `details`。

登录接受 JSON 凭证，OpenAPI 使用 HTTP Bearer，而非 OAuth2 password form。用户名 1–50 字符且不能全为空白，保留已有账号名称的空格身份；密码非空且不超过 72 UTF-8 字节，不截断。401 保留 `WWW-Authenticate: Bearer`。安全 Redis 故障返回 503，不能降级为未撤销/未限流。
