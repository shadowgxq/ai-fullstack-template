# Backend Standards

`standards/` 保存后端实现硬规则：实现流程、编码、分层职责、文件组织、API/错误契约、基础设施。只写约束，不写选型决策（技术基线看 [../architecture/technology-baseline.md](../architecture/technology-baseline.md)）。

> 入口分流和全局读取顺序以上层 [../README.md](../README.md) 为准，本文只做目录内导航。

| 文件 | 什么时候看 |
|---|---|
| [implementation-workflow.md](./implementation-workflow.md) | 新增资源域 / 新增接口时：实现步骤顺序、每步产出物与完成判据（步骤 owner） |
| [python-development.md](./python-development.md) | 日常后端实现入口：命名、类型注解、Pydantic/SQLAlchemy、异常、日志、import、配置、验证 |
| [file-organization.md](./file-organization.md) | 文件/模块命名、新代码放哪一层、放置规则（放置 owner） |
| [layer-definition.md](./layer-definition.md) | 已决定写某层后：该层职责、函数签名、数据边界、跨层依赖（分层 owner） |
| [api-and-error-contract.md](./api-and-error-contract.md) | 路由、统一响应、异常、状态码、鉴权（API 契约 owner） |
| [infrastructure.md](./infrastructure.md) | 配置、DB 会话/事务、Redis 缓存与容错、JWT/安全、请求日志中间件（横切基础设施 owner） |

新增、删除或改名 standards 文件时，同步更新 [后端专项导航](../README.md)；涉及文档职责变化时同步 [文档地图](../../../README.md)。
