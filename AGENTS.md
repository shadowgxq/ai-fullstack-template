# 全栈协作入口

本文件维护全仓库必须遵守的公共约束；各端 `AGENTS.md` 只补充任务导航，工程细则按需读取。

## Communication

- 默认使用中文沟通和解释。保留行业、框架和协议的原名，不强行直译；已有自然、准确的中文术语可沿用，不机械全英文替换。
- 命令、路径、文件名、标识符、环境变量、配置键、错误信息、日志和 URL 保持原文。

## Working Principles

- 先检查工作区、当前实现与确认需求，理解交互路径和数据流；不确定时先查代码和事实源文档，不凭空补全。
- 仍有影响结果的重大歧义时先澄清；影响较小时可自主判断，并在交付时说明假设。
- 只修改当前任务直接相关的内容，不顺手重构、格式化或抽象；不覆盖、回滚或提交 dirty worktree 中的无关改动。
- 未经明确要求不执行 `git add`、`git commit`、`git push`；用户要求提交 PR 时，可创建相关分支和提交，但不自动合并。

## Constraints

- 开发阶段只做最小必要检查，不主动执行 `dev server`、`build`、`deploy`、`publish` 等高副作用命令。

## 文档与任务路由

- 先通过 [文档地图](docs/README.md) 确认事实源，再读受影响端入口；首次编辑前读完必要规范，任务范围扩大时补读。
- 共享规则只在对应事实源维护；端内不复制公共规则、PRD、接口定义或任务状态，不放宽根安全规则和跨端契约。
- 长期文档只保留可独立理解的事实与规则；对话、执行提示词和单次交付记录按 [文档维护规则](docs/README.md#文档维护规则) 分流，不直接粘贴进产品需求或工程规范。
- Manager 状态只经项目控制入口修改；按 [工具入口](docs/engineering/workflow/tooling.md) 读取实际 Skill，不复制流程或伪造批准。
- 不默认加载全部文档。`docs/engineering/common/README.md` 只在涉及下表中的公共工程细节时读取，不是每个任务的额外必读项。

| 任务 | 入口 |
|---|---|
| 前端代码或前端工程文档 | [frontend/AGENTS.md](frontend/AGENTS.md) |
| 后端代码或后端工程文档 | [backend/AGENTS.md](backend/AGENTS.md) |
| Agent Runtime 或 AI 工程文档 | [ai-service/AGENTS.md](ai-service/AGENTS.md) |
| 数据库、缓存、配置、运行环境或跨端验证 | [公共工程细则](docs/engineering/common/README.md) |
| 需求拆分、跨端协作、任务进度 | [交付流程](docs/engineering/workflow/delivery.md)、[当前计划](manager/plan.yaml) |
| 架构、接口、业务 | [架构](docs/architecture/README.md)、[契约](docs/contracts/README.md)、[产品](docs/product/README.md) |
| 仅文档变更的检查 | [公共工程细则：验证范围](docs/engineering/common/README.md#验证范围) |
