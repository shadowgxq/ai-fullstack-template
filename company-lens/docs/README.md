# 项目文档

首次接手先读[项目状态](project-status.md)、[PRD](product/prd.md)和[系统技术架构](architecture/ai-architecture.md)，之后按任务查阅详细设计。

| 文档 | 唯一职责 |
|---|---|
| [PRD](product/prd.md) | 产品范围、用户路径、发布验收 |
| [需求索引](product/requirements-map.md) | 27 项 S/T/M 需求与实施状态 |
| [系统技术架构](architecture/ai-architecture.md) | 系统边界、运行恢复、部署与 26 项 SYS / 78 条 AC |
| [系统接入设计](design/system-integration-details.md) | 表与事务、DTO、事件算法、前端接入及升级验证 |
| [执行设计](design/AI-Agent通用模板_技术设计与实现规范_v1.1.md) | Run、受控调用、预算、持久化、恢复与 HTTP/事件合同 |
| [业务设计](design/AI公司研究_业务架构与接入设计_v1.1.md) | 身份、来源、财务计算、研究图、审计与业务里程碑 |
| [工程规范](engineering/ai-development-standard.md) | 开发流程、契约生成、编码与验证约定 |
| [命令表](engineering/commands.md) | 实际脚本与执行前置条件 |
| [架构决策](architecture/decisions/README.md) | 重要选择、原因与代价 |
| [前端文档](../frontend/docs/frontend/README.md) | 现有前端分层、组件、样式和配置 |
| [项目状态](project-status.md) | 当前实现、验证情况与下一步 |

## 任务与来源

- [初始化任务](changes/0001-bootstrap/spec.md)：尚未执行的 D0 工程准备；不等于架构 V1 可靠运行服务验收。
- [系统需求机器索引](references/requirement-index.json)：定位架构正文中的 SYS / AC，不独立维护规则或进度。
- [架构实施规划输入](engineering/architecture-planning.md)：三份设计的消费范围及可选 Manager/OpenSpec 交接；当前仍使用 `docs/changes/`。
- [架构包导入记录](references/architecture-import.md)：来源、副本与合并边界。
- [变更模板](templates/change.md)：规格、计划、验证和交接合写；复杂任务确有需要时再拆分。
- [原始业务材料](<product/sources/ai-berkshire 公司研究模块.md>)与[前端迁入记录](references/frontend-import.md)：来源溯查。
- [历史归档](archive/README.md)：旧设计、导入记录和上游前端资料，不作为当前需求或执行入口。

同一规则只在责任文档维护，其他文档链接引用。设计中的表、接口和流程是目标合同；是否实现以源码和项目状态为准。`AGENTS.md` 仅保留项目导航。
