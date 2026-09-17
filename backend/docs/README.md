# 文档中心（docs）

> 本仓库是 **backend-agent-template**（FastAPI + PostgreSQL + SQLAlchemy 2.0（同步）+ Pydantic v2 + Redis + JWT，Python ≥ 3.10，uv 管理）后端模板。
> 本文件是文档体系的入口与地图，只判断「该读哪个文档」，不堆全部内容。接口事实源是运行时 OpenAPI（`/docs`）。

## 目录职责

| 目录 | 作用 |
|---|---|
| [architecture/](./architecture/technology-baseline.md) | 技术基线、`app/` 分层、依赖方向、数据流边界 |
| [standards/](./standards/README.md) | 实现流程、日常编码、分层职责、文件组织、API/错误契约、基础设施（硬规则） |

> 说明：本模板只沉淀**长期稳定的工程规范**。具体业务需求（PRD）、接口清单、数据库设计、进度与待办属于**基于模板派生的具体项目**，请在派生项目里另建 `docs/prd/`、`docs/tech/`、`ROADMAP.md` 承载，不要写进模板的 `docs/`。

## standards 文档

| 文件 | 什么时候看 |
|---|---|
| [standards/implementation-workflow.md](./standards/implementation-workflow.md) | 新增资源域 / 新增接口时：实现步骤顺序、每步产出物与完成判据（步骤 owner） |
| [standards/python-development.md](./standards/python-development.md) | 日常后端实现入口：命名、类型注解、Pydantic/SQLAlchemy、异常、日志、import、配置、验证 |
| [standards/file-organization.md](./standards/file-organization.md) | 判断文件/模块命名、新代码放哪一层、放置规则（放置 owner） |
| [standards/layer-definition.md](./standards/layer-definition.md) | 已决定写某层后，查该层职责、函数签名、数据边界、跨层依赖（分层 owner） |
| [standards/api-and-error-contract.md](./standards/api-and-error-contract.md) | 路由、统一响应 `{code,message,data}`、异常、状态码、鉴权（API 契约 owner） |
| [standards/infrastructure.md](./standards/infrastructure.md) | 配置、DB 会话 / 事务、Redis 缓存与容错、JWT/安全、请求日志中间件（横切基础设施 owner） |

## 读取顺序（后端任务）

1. 日常编码入口：[standards/python-development.md](./standards/python-development.md)。
2. 新增资源域或从零加接口时，按 [standards/implementation-workflow.md](./standards/implementation-workflow.md) 的步骤清单执行。
3. 涉及新代码放哪一层、模块命名时看 [standards/file-organization.md](./standards/file-organization.md)。
4. 涉及某层（api/service/repository/model/schema）怎么写、跨层边界时看 [standards/layer-definition.md](./standards/layer-definition.md)。
5. 涉及接口形状、响应结构、异常、状态码、鉴权时看 [standards/api-and-error-contract.md](./standards/api-and-error-contract.md)。
6. 涉及配置、事务、Redis、JWT、中间件时看 [standards/infrastructure.md](./standards/infrastructure.md)。
7. 涉及技术选型、依赖方向、`app/` 分层时看 [architecture/technology-baseline.md](./architecture/technology-baseline.md)。

## 硬约束（不在细则里重复，但必须遵守）

- **统一响应**：所有接口经 `ApiResponse[T]` / `success_response(...)` 返回 `{code,message,data}`，不手拼 dict、不返回裸 ORM 对象。
- **统一异常**：业务错误只抛 `core/exceptions.BusinessException` 及子类，由 `main.py` 注册的全局 handler 转响应；不裸抛 `HTTPException`、不返回错误字典。
- **敏感信息**只走 `.env` / 环境变量（`core/config.Settings` 读取），永不硬编码、永不入库、永不进 Git。
- **表结构变更**必须生成 Alembic 迁移并 `upgrade head` 验证。

## 维护规则

- 只把长期稳定的工程规范写进 `docs/`；临时执行计划、当前任务状态、具体业务 PRD 不写进来。
- 每条具体规则只放一个 owner 文件，其他文件引用不复制。
- 新增、改名或删除规范文件时，同步更新本文件和 [standards/README.md](./standards/README.md) 的文档地图。
