# 后端技术基线与架构边界

`app/` 均指 `backend/app/`。安装、启动和检查命令的唯一入口为 [后端 README](../../../../backend/README.md) 与 Makefile。

## 技术基线

| 领域 | 选型与边界 |
|---|---|
| Python | Python ≥3.12；本地默认、Docker 与 CI 使用 3.12 |
| 框架 | FastAPI，同步 `def` 路由；Pydantic v2 DTO，OpenAPI 由提供方代码生成 |
| 数据访问 | SQLAlchemy 2.0 同步 Session + psycopg2；Alembic 版本化迁移 |
| 数据库 | PostgreSQL；与 AI 服务分库分角色，禁止跨服务直接查询 |
| 缓存与认证 | Redis；python-jose JWT + bcrypt，保留既有登录限流与 token 黑名单 |
| 包管理 | uv + 独立 uv.lock，冻结依赖安装，不混用 pip/poetry |
| 检查 | `make check` 只读检查和测试；`make format` 才修复代码；`make lint` 不自动修复 |

不引入重型 DI、额外查询构建器或未经评估的依赖。异步数据库改造必须整体评审，当前只安装同步驱动，不预装未使用的 asyncpg 或 passlib。

## 依赖与数据流

```text
HTTP → api/v1 → services → repositories → models / DB
          │        │            │
          └── schemas / deps    └── core（配置、会话、日志等）
```

业务路由不查 ORM、不自建 engine；services 收口规则和事务，repositories 只负责存取。`schemas`、`core` 为横切模块，不反向依赖业务。`/ready` 是运维探针例外：读取已迁移表与 Redis 的可用性，不承载业务查询、不执行迁移。

应用启动不自动改表。Alembic 升级是独立部署步骤；请求事务使用 `transaction(db)`。业务异常通过统一 handler 转 `{code,message,data}`。

Redis 可选缓存允许降级回源；认证、登录限流与 token 撤销不可用时返回 503。初始化测试不代表生产安全验收。

细则按需读 [分层](../standards/layer-definition.md)、[目录](../standards/file-organization.md)、[Python](../standards/python-development.md)、[基础设施](../standards/infrastructure.md)。跨端规范以 [公共约束](../../common/README.md) 为准。
