# 后端分层与复用边界

适用于 `backend/app/` 的同步 FastAPI + SQLAlchemy 实现。通用命名/注释与抽象见 [公共代码质量](../../common/code-quality.md)，文件落点见 [目录](file-organization.md)。以下分层是本仓库约定，不是 FastAPI 强制所有项目采用的目录结构。

## 依赖方向

```text
HTTP → api/v1 → services → repositories → models
         │          │             │
         └── schemas / api dependencies
                    └── core（配置、会话、安全、错误等）
```

调用只向下；API composition 可以装配仓储/服务，业务路由不能借此直接查询 ORM。`schemas` 和 `core` 不反向依赖业务；配置/事务等横切细节由 [基础设施](infrastructure.md) 维护。

## 各层职责

| 层 | 负责 | 不负责 |
|---|---|---|
| `api/v1` | 路由、参数 schema、调用 service、显式映射 response model | 业务计算、ORM 查询、手写事务 |
| `api/dependencies.py` | 解析身份、认证、组合共享依赖；资源授权上下文注入 | 复制每个领域的业务规则 |
| `services` | 用例编排、资源权限与业务不变量、事务及结果 | Request/Response、HTTP 上下文、直接 ORM 查询 |
| `repositories` | 参数化查询、add/flush/refresh；返回内部实体或标量 | 业务决策、HTTP schema、commit/rollback |
| `models` | 表、字段、约束与 ORM 映射 | 调用服务、HTTP 序列化 |
| `schemas` | 请求/响应形状、约束、公开字段 | ORM 持久化、权限判断、重复状态事实 |
| `core` | 与业务无关的配置、连接、安全原语、错误与日志 | 用户资源、repository、service 或 API import |

`/health`、`/ready` 和 OpenAPI 是运维/协议例外；尤其 `/ready` 只检查依赖，不按业务接口强加 Service/Repository 全套，也不执行迁移。

## 事务与正确性

- 路由继续同步 `def`，service 构造注入已有 repository；Session 从请求依赖获得，不在每层各建连接。service 管理一个用例的提交/回滚，repository 只写入事务。
- 输入格式用 Pydantic/Query/Path 校验；跨字段业务规则与资源权限在 service 的实际操作边界检查。认证通过不等于有权访问任意资源，不能只依赖前端隐藏按钮。
- 预查询“不存在”不能防并发重复；数据库唯一约束兜底，Service 在 rollback 后区分真实唯一冲突与其他数据库错误。不把所有 IntegrityError 一律改成“已存在”。
- DTO 不要求逐字段等同 ORM。当前 AuthService 可在进程内返回 User，由路由显式选择 `id/username` 并通过 response model；禁止把裸 ORM、密码字段或数据库行直接作为公开响应。复杂用例再引入内部结果类型，不预建一套重复领域模型。
- 新查询在 repository 内使用现有查询风格和绑定参数；列表有上限、稳定排序及必要分页，不在返回后任意截断来掩盖无界查库。索引根据真实筛选/排序与唯一性需要设计，不给每个可筛字段机械加索引。
- 数据库事务不能回滚已完成的 Redis 或远端调用；跨系统写入进入范围时明确失败顺序、重试/补偿或消息边界，不先返回业务成功再假定后续步骤一定完成。

## 复用先找现有落点

| 新代码需要 | 优先复用 |
|---|---|
| 当前用户或认证依赖 | `api/dependencies.py`，不在每条路由解析 JWT |
| 相同领域查询与约束 | 对应 repository / service，不复制到另一个域 |
| HTTP 信封与业务错误 | `schemas/response.py`、`core/exceptions.py` 与已注册 handler |
| 事务、Redis、安全原语 | `core/session.py`、`core/redis_client.py`、`core/security.py` |

纯计算可以是就近函数，跨模块替换边界才需要小接口；不为每个简单接口预建 BaseRepository、通用 CRUD 引擎或大量透传 class。新增资源按 [实现顺序](implementation-workflow.md) 选择必要层，而非生成所有空文件。

参考 [FastAPI 多文件应用](https://fastapi.tiangolo.com/tutorial/bigger-applications/) 的 APIRouter/依赖装配、[SQLAlchemy Session](https://docs.sqlalchemy.org/en/20/orm/session_basics.html) 的事务生命周期；本仓库在此基础上固定 Service 事务所有权。静态 [架构检查](../../../../scripts/check_architecture.py) 只能覆盖部分 import/事务规则，资源权限、查询效率和业务语义仍需 review 与测试。
