# 后端专项导航

本文 `app/` 指 `backend/app/`。公共约束继承 [根 AGENTS.md](../../../AGENTS.md)；数据库、缓存、配置与验证范围按需查 [公共工程细则](../common/README.md)。

| 任务 | 按需读取 |
|---|---|
| 选型、依赖方向 | [技术基线](architecture/technology-baseline.md) |
| 分层、目录、Python | [分层](standards/layer-definition.md)、[目录](standards/file-organization.md)、[编码](standards/python-development.md) |
| API / 鉴权 / 错误 | [契约规范](standards/api-and-error-contract.md) |
| 数据库 / Redis / JWT | [基础设施](standards/infrastructure.md) |
| 新资源或接口 | [实现顺序](standards/implementation-workflow.md) |

跨端交付统一使用 [交付流程](../workflow/delivery.md)。后端保留同步 SQLAlchemy + Alembic；AI 服务不复用后端 ORM/数据库权限。
