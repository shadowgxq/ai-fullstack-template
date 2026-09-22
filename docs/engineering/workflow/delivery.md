# 全栈交付流程

## 一个需求，一个跨端交付单元

`REQ-ID + 验收 → 架构/ADR → 提供方 schema/契约 → OpenSpec change → tasks → 测试证据 → PR`。

使用方产品需求正文只在 `docs/product/`；设计和任务在 `openspec/changes/<change>/`；批次、依赖与 change 阶段在根 `manager/plan.yaml`；细项进度只记 tasks，不在计划里复制任务勾选。不为同一能力按三端各建一份产品需求。不改变需求/契约的小修复可显式使用根 `repairs/`；同一工作不进入两条队列。

模板自身的文档、导航或工具维护可以直接在 PR 记录范围和证据，不为记录工作过程新建产品需求或重复任务包。涉及跨端实现或行为变更时仍使用 change 管理；模板发布时按 [文档维护规则](../../README.md#文档维护规则) 清理已完成的模板维护记录，不将其带入使用方初始状态。

Manager 保留 `updated_at/current/requirements/openspec/batches` 结构。模板无任务时，列表为空、current 字段为空且 `updated_at` 为 null；登记任务后填写实际更新时间。requirement 引用 source；change 引用需求 ID、架构、契约、任务路径。任务明确 owner、读写范围、依赖、验收命令及证据；只有实际完成才能勾选。

工具发现与归档规则见 [工具入口](tooling.md)。

## 最小上下文包

[根 AGENTS](../../../AGENTS.md) → [文档地图](../../README.md) → 涉及端 AGENTS → 当前 change 或 repair（如有）→ 需求相关章节 → 架构边界 → 接口与直接消费者；只读取任务涉及部分，不强制每个任务建立完整文档包。

代码任务通过各端编码入口读 [公共代码质量](../common/code-quality.md)，Python 任务再复用 [语言共性](../common/python.md)；已读内容不重复加载。UI 追加组件/状态，DB 追加迁移，Worker 追加恢复。数据、配置或验证涉及公共细节时查 [公共工程细则](../common/README.md) 对应章节；文档任务不额外加载代码规范，不默认读取历史 PRD、日志或完整社区 skill。

交接包含：目标/REQ-ID、已读输入与版本、允许修改文件、禁止区域、依赖契约、验证命令、完成条件、未决问题。范围扩大时补读相关规则与消费者。

## 实现与 review

实现前在当前任务上下文中确认四件事：要保持的行为/不变量、现有可复用入口、状态与副作用拥有者、受影响的直接消费者。可以简短记录在现有 task/PR，不另建计划或要求逐函数审批。

完成后按 [公共变更复核](../common/code-quality.md#变更复核) 检查 diff 与真实调用链，再按涉及端验证。review 说明发现、修正、证据及未验证边界；正确性和契约问题优先解决，不把主观风格或未经测量的性能猜测设为强制重构。

## 并行与冲突

先串行确认契约/迁移，再并行开发无共享写点的端。根计划、共享 schema、迁移由单一 owner 写入；同端锁文件串行更新。子 Agent 只交付自己的变更和证据，Manager 汇总后回写进度。

## 同一 PR 的文档同步

| 变化 | 必须同步 |
|---|---|
| 用户行为 / 验收 | product REQ、change specs/tasks、回归测试 |
| 边界 / 选型 | architecture/ADR、依赖配置、受影响 README |
| API / DTO / 状态 / 错误 | 提供方代码、`make contracts`、语义说明、消费者测试 |
| 表结构 / Checkpoint 兼容 | 迁移、兼容说明、真实 PostgreSQL 验证 |
| 新组件 / 目录 | 专项组件清单或地图，不复制规范 |
| 环境变量 / 命令 | `.env.example`、README、Compose/CI |
| 完成 / 阻塞 | tasks 证据与 plan 状态，不复制需求全文 |

自动检查覆盖链接、内容卫生、任务引用、各端检查、schema 漂移和真实启动。语义一致性仍需评审，不能将“链接通过”描述为架构正确性证明。
