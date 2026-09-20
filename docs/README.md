# 文档地图

先读 [根 AGENTS.md](../AGENTS.md)，再通过本页定位受影响端入口与事实源。首次编辑前只读取当前任务需要的规范，范围扩大时再补读。

## 规则归属

根 `AGENTS.md` 维护简短、强制的公共约束；各端 `AGENTS.md` 只维护任务导航；`docs/engineering/common/` 保留按需工程细则；各端工程文档维护实现规范。本页只负责目录职责与流转，不复制规则正文。

| 唯一事实源 | 维护者 / 按需场景 |
|---|---|
| [根 AGENTS.md](../AGENTS.md) | 所有 Agent；沟通、改动范围、安全边界、验证原则与文档路由 |
| [公共工程细则](engineering/common/README.md) | 涉及数据库、缓存、配置、运行环境或验证范围时读取 |
| [交付流程](engineering/workflow/delivery.md) | Manager；需求、联调、多 Agent 协作 |
| [前端规范](engineering/frontend/README.md) | 前端负责人；UI、状态、路由、工具链；入口为 [frontend/AGENTS.md](../frontend/AGENTS.md) |
| [后端规范](engineering/backend/README.md) | 后端负责人；认证、CRUD、迁移、Redis；入口为 [backend/AGENTS.md](../backend/AGENTS.md) |
| [AI 服务规范](engineering/ai-service/README.md) | AI 负责人；技术基线、分层、Workflow/State、恢复、模型/工具、API/产物与 Evals；入口为 [ai-service/AGENTS.md](../ai-service/AGENTS.md) |
| [产品需求](product/README.md) | 产品负责人；需求 ID 与验收 |
| [架构与 ADR](architecture/README.md) | 架构负责人；边界、数据流、决策 |
| [跨端契约](contracts/README.md) | 提供方负责人；DTO、状态、错误与生成 schema |
| [当前计划](../manager/plan.yaml) | Manager；跨端批次与唯一进度 |
| [OpenSpec 配置](../openspec/config.yaml) | 各 change 的设计、任务与增量规格 |
| [修复队列](../repairs/README.md) | 小修复；不同时建立另一份执行状态 |

## 维护与流转

新增或调整规则时，先确定唯一维护位置，再更新导航；根规则变更不在 common 或各端复制一份。工程细则按主题放入 common 或相应端文档，避免持续堆入 `AGENTS.md`。

历史业务从工作树删除，以 Git 历史追溯。已合并 change 进入 `openspec/changes/archive/`，生效规格在 `openspec/specs/`；两者不作为默认任务上下文。命令在服务 README 与 Makefile 维护；schema 由提供方生成；版本以各端 lockfile 为准。
