# 文档地图

首次只读本页、根 AGENTS 和受影响端 AGENTS；任务扩大时再补读。

| 唯一事实源 | 维护者 / 按需场景 |
|---|---|
| [公共工程约束](engineering/common/README.md) | 协作负责人；所有工程变更 |
| [交付流程](engineering/workflow/delivery.md) | Manager；需求、联调、多 Agent 协作 |
| [前端规范](engineering/frontend/README.md) | 前端负责人；UI、状态、路由、工具链 |
| [后端规范](engineering/backend/README.md) | 后端负责人；认证、CRUD、迁移、Redis |
| [AI 服务规范](engineering/ai-service/README.md) | AI 负责人；图、Worker、checkpoint |
| [产品需求](product/README.md) | 产品负责人；需求 ID 与验收 |
| [架构与 ADR](architecture/README.md) | 架构负责人；边界、数据流、决策 |
| [跨端契约](contracts/README.md) | 提供方负责人；DTO、状态、错误与生成 schema |
| [当前计划](../manager/plan.yaml) | Manager；跨端批次与唯一进度 |
| [OpenSpec 配置](../openspec/config.yaml) | 各 change 的设计、任务与增量规格 |
| [修复队列](../repairs/README.md) | 小修复；不同时建立另一份执行状态 |

`examples/` 仅为历史业务样例，不是当前需求。Company Lens 已在基线提交移除，不从旧记忆恢复业务约束。命令只在服务 README 与 Makefile 维护；schema 由提供方生成；版本以各端 lockfile 为准。
