# 全栈协作入口

先读 [文档地图](docs/README.md)，再读修改目录的 `AGENTS.md`。不要默认加载全部文档。

## 公共规则

- 默认中文沟通；命令、路径、标识符保留原文。
- 以当前代码和确认需求为准；先检查工作区，不覆盖无关改动。
- 共享规则只写一次；子目录仅补充本端约束，不覆盖安全与跨端契约。
- 需求、接口、迁移、配置或命令改变，在同一 PR 更新事实源与验证证据。
- 不提交密钥，不擅自调用付费服务、部署生产或合并 PR。发布需明确授权。
- 区分已实现、已验证、未实现和受阻项，不以 mock 代替真实依赖验证。

## 按任务读取

| 任务 | 入口 |
|---|---|
| 工程边界、安全与验证 | [公共规范](docs/engineering/common/README.md) |
| 需求拆分、跨端协作、进度 | [交付流程](docs/engineering/workflow/delivery.md)、[计划](manager/plan.yaml) |
| 前端代码 | [frontend/AGENTS.md](frontend/AGENTS.md) |
| 后端代码 | [backend/AGENTS.md](backend/AGENTS.md) |
| Agent Runtime | [ai-service/AGENTS.md](ai-service/AGENTS.md) |
| 架构、接口、业务 | [架构](docs/architecture/README.md)、[契约](docs/contracts/README.md)、[产品](docs/product/README.md) |
