# Layer Definition

各层（api / core.deps / services / repositories / models / schemas / core）的职责、函数签名约定和数据边界。适用范围：`app/`（FastAPI + SQLAlchemy 2.0 同步 + Pydantic v2）。
新代码放哪一层、模块怎么命名看 [file-organization.md](./file-organization.md)；横切基础设施（config/session/redis/security/中间件）细则看 [infrastructure.md](./infrastructure.md)；技术基线与依赖方向看 [../architecture/technology-baseline.md](../architecture/technology-baseline.md)。

## 分层总则

- 依赖只向下、不反向、不跨级：`api → services → repositories → models`；`schemas`/`core` 为横切。
- 每层只做本层职责，不替下层或上层做事；跨层只通过明确的函数签名 / 构造参数传递，不靠隐式全局状态。
- 业务规则只在 `services`；`api` 不写规则、`repositories` 不含规则。

## api/v1（路由层）

- 只做：声明路由与入参（`Query`/`Path`/Body schema）、调用 service、用 `ApiResponse` / `success_response` 包返回。
- 路由为**同步 `def`**；每个路由标 `response_model=ApiResponse[...]`；入参约束就近用 `Query(1, ge=1, le=50)`，不在函数体里手写校验。
- **不写业务规则、不直接查 ORM、不碰 `Session` 之外的 DB 细节**；service 经工厂依赖装配（如 `get_auth_service` 里 `AuthService(UserRepository(db))`），`db` 由 `Depends(get_db)` 注入。
- 路由按资源域分模块，各自 `APIRouter(prefix=..., tags=...)`，在 `main.py` 用 `include_router(prefix="/api/v1")` 注册。

```python
router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service(db=Depends(get_db)) -> AuthService:
    return AuthService(UserRepository(db))


@router.post("/login", response_model=ApiResponse[TokenResponse])
def login(payload: LoginRequest, service: AuthService = Depends(get_auth_service)):
    access_token = service.login(payload.username, payload.password)
    return success_response({"access_token": access_token, "token_type": "bearer"})
```

## core/deps.py（依赖注入）

- 放可复用的 FastAPI 依赖（`get_current_user`、`oauth2_scheme`）；鉴权 / 取当前用户在此收口，失败抛 `HTTPException(401)` 或 `BusinessException` 子类（如 `TokenRevokedException`），不在每个路由里重复解析 token。
- 依赖可组合下层能力（解 JWT、查黑名单、读用户缓存、回源查库），但不写具体业务规则。

## services（业务编排层）

- 放业务规则与编排：取数（调 `repositories`）+ 规则计算（如登录失败限流）+ 拼装 / 返回领域值。
- 采用**类 + 构造注入仓储**的风格（`class AuthService: def __init__(self, repo: UserRepository)`）；业务方法为同步 `def`，入参用业务参数，返回领域值或已足够拼装出参的数据，不把裸 ORM 直接交给路由做序列化。
- 不 import `api`、不碰 `Request`/`Response`/HTTP 状态码；错误用 `BusinessException` 子类表达（如 `LoginFailedException()`）。
- 写操作用 `with transaction(db):` 收口事务（见 [infrastructure.md](./infrastructure.md)）。

## repositories（数据访问层）

- 只封装对 ORM 的查询 / 写入的**类**（`class UserRepository: def __init__(self, db: Session)`），方法返回 ORM 对象或标量；**不含业务规则、不依赖 `schemas`/`services`**。
- 查询用 `self.db.query(Model).filter(...)`（沿用现有风格）；条件按入参组合。
- 写方法可执行 `add`/`commit`/`refresh`（沿用现有 `UserRepository.create`），或把提交边界交给上层 `transaction(db)`；同一调用链保持单一 commit 点，不与上层事务边界冲突。

## models（ORM 层）

- SQLAlchemy 2.0 声明式：继承 `core/base.Base`，字段用 `Mapped[...]` + `mapped_column(...)`，可空标 `| None`。
- 唯一 / 可筛字段加 `unique=True` / `index=True`。
- 最底层，不反向 import 上层；表结构变更必须生成 Alembic 迁移，并在 `alembic/env.py` 保证该模型被 import（注册到 `Base.metadata`）。

## schemas（出入参契约层）

- 出入参用 Pydantic v2 `BaseModel`，字段 `snake_case`；按用途分型（`Request`/`Response`），不复用一个模型既当入参又当出参。
- 通用响应结构（`ApiResponse[T]`、`success_response`）集中在 `schemas/response.py`，不在各域重复定义。
- 字段类型即契约：与 ORM 列对齐；不在 service/repository 内另造平行 schema。

## core（横切基础设施）

> 各模块职责与写法以 [infrastructure.md](./infrastructure.md) 为 owner，这里只列边界。

- `config`（settings）/ `session`（engine + `get_db` + `transaction`）/ `security`（JWT + bcrypt）/ `redis_client`（`redis_safe`）/ `exceptions`（`BusinessException`）/ `exception_handlers` / `logging` / `middlewares`：被各层依赖，自身不依赖业务层。
- 唯一的 engine / session 来源在 `core/session`，业务层不自建连接；唯一的 Redis 客户端在 `core/redis_client`。

## 跨层禁止项

- 路由里写业务规则 / 直接 ORM 查询 / 手拼错误响应 / 写 `async def`（本模板同步）。
- service 依赖 `api`、读 HTTP 上下文、返回裸 ORM 对象给路由做序列化。
- repository 写业务规则、依赖 `schemas`/`services`、自决与上层冲突的事务提交策略。
- 任意层绕过 `schemas` 直接把 ORM 对象序列化给前端，或绕过 `core/config` 散读环境变量、绕过 `core/redis_client` 直连 Redis。
