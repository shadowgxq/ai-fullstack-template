# AI 服务工程规范

公共约束继承 [根 AGENTS.md](../../../AGENTS.md)，不在本目录复制。本文只做导航；技术基线、实现规则和验证要求分别由下列文件维护。

## 使用边界

先核对 [当前实现与目标](../../architecture/README.md)。本目录规定如何实现现有架构，不新增产品需求，也不把目标能力标为已完成。

“当前基线”适用于已有代码；“扩展时”表示只有相应能力进入任务范围后才适用，不要求为遵守规范预先创建空模块、安装 SDK 或实现整套 Runtime。能力状态统一见 [技术基线](architecture/technology-baseline.md)。

## 按任务读取

| 任务 | 必要规范 |
|---|---|
| 任意 AI 服务实现 | [Python 开发](standards/python-development.md)；首次接入或改变依赖时补读 [技术基线](architecture/technology-baseline.md) |
| 新模块、依赖注入、目录调整 | [分层与文件组织](standards/layer-and-file-organization.md) |
| Workflow、Node、State、routing、并行 | [Workflow 与 State](standards/workflow-and-state.md) |
| Worker、事务、迁移、恢复、interrupt、幂等 | [Checkpoint 与副作用](standards/checkpoint-and-effects.md) |
| 模型、工具、prompt、MCP、RAG 等扩展 | [模型与工具](standards/model-and-tools.md) |
| HTTP、DTO、事件、产物、错误和观测 | [API、事件与产物](standards/api-events-and-artifacts.md) |
| 回归、故障注入、recorded replay、Evals | [测试与 Evals](testing/testing-and-evals.md) |

## 关联事实源

系统职责与设计取舍见 [Runtime 架构及 ADR](../../architecture/ai-service/agent-runtime-architecture.md)；字段、状态和错误语义见 [跨端契约](../../contracts/README.md)。公共配置与验证范围查 [公共工程细则](../common/README.md)，跨端任务沿用 [现有交付流程](../workflow/delivery.md)。

安装、启动和检查命令仍由 [AI README](../../../ai-service/README.md)、[AI Makefile](../../../ai-service/Makefile) 与 [根 Makefile](../../../Makefile) 维护。新增或改名规范时同步本页；职责变化再同步 [文档地图](../../README.md)。
