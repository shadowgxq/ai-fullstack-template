# 后端专项导航

`app/` 指 `backend/app/`。公共协作约束继承 [根 AGENTS.md](../../../AGENTS.md)；命名/注释/复用与 Python 通用写法由公共文档维护，本端只补同步 API、业务分层和基础设施差异。

| 任务 | 最小读取集 |
|---|---|
| 新增或修改后端代码 | [公共代码质量](../common/code-quality.md) + [Python 公共写法](../common/python.md) + [本端入口](standards/python-development.md) |
| 业务、资源权限、分层或事务 | [分层与复用](standards/layer-definition.md)；新建/移动模块再读 [目录](standards/file-organization.md) |
| API / 鉴权 / 错误 | [API 规范](standards/api-and-error-contract.md) 与 [跨端契约](../../contracts/README.md) |
| 数据库 / Redis / JWT | [基础设施](standards/infrastructure.md)，公共约束查 [数据与配置](../common/README.md) |
| 新资源或接口 | [实现顺序](standards/implementation-workflow.md) |
| 选型或执行模型变化 | [技术基线](architecture/technology-baseline.md) |
| 仅后端文档 | 目标文档及其直接引用；[文档检查范围](../common/README.md#验证范围) |

已读公共规范不重复加载；跨端任务使用 [交付流程](../workflow/delivery.md)。保留同步 SQLAlchemy + Alembic；AI 服务不复用后端 ORM/数据库权限，也不照搬此处的事务实现。
