# 全栈 Vibe Coding 交付流程

## 一个需求，一个跨端交付单元

`REQ-ID + 验收 → 架构/ADR → 提供方 schema/契约 → OpenSpec change → tasks → 测试证据 → PR`。

需求正文只在 `docs/product/`；设计和任务在 `openspec/changes/<change>/`；批次、依赖与 change 阶段在根 `manager/plan.yaml`；细项进度只记 tasks，不在计划里复制任务勾选。不为同一能力按三端各建一份产品需求。不改变需求/契约的小修复可显式使用根 `repairs/`，否则使用 OpenSpec；同一工作不进入两条队列。

保留 Manager 的 `updated_at/current/requirements/openspec/batches` 结构。requirement 引用 source；change 引用需求 ID、架构、契约、任务路径。任务明确 owner、读写范围、依赖、验收命令及证据；只有实际完成才能勾选。

工具发现与归档规则见 [工具入口](tooling.md)。

## 最小上下文包

[根 AGENTS](../../../AGENTS.md) → [文档地图](../../README.md) → 涉及端 AGENTS → 当前 change 或 repair → 需求相关章节 → 架构边界 → 接口与直接消费者；仅加载当前任务涉及的部分。UI 追加组件/状态规范；DB 追加迁移；Worker 追加恢复语义。公共强制规则已在根入口，只有涉及数据库、缓存、配置或验证范围等细节时才补读 [公共工程细则](../common/README.md)，不默认加载全仓库、历史 PRD 和日志。

交接包含：目标/REQ-ID、已读输入与版本、允许修改文件、禁止区域、依赖契约、验证命令、完成条件、未决问题。范围扩大时补读相关规则与消费者。

## 并行与冲突

先串行确认契约/迁移，再并行开发无共享写点的端。根计划、共享 schema、迁移由单一 owner 写入；同端锁文件串行更新。子 Agent 只交付自己的变更和证据，Manager 汇总后回写进度。

## 同一 PR 的文档同步

| 变化 | 必须同步 |
|---|---|
| 用户行为 / 验收 | product REQ、change specs/tasks、回归测试 |
| 边界 / 选型 | architecture/ADR、依赖配置、受影响 README |
| API / DTO / 状态 / 错误 | 提供方代码、`make contracts`、语义说明、消费者测试 |
| 表结构 / checkpoint 兼容 | 迁移、兼容说明、真实 PostgreSQL 验证 |
| 新组件 / 目录 | 专项组件清单或地图，不复制规范 |
| 环境变量 / 命令 | `.env.example`、README、Compose/CI |
| 完成 / 阻塞 | tasks 证据与 plan 状态，不复制需求全文 |

自动门禁覆盖链接、台账引用、各端检查、schema 漂移和真实启动。语义一致性仍需评审，不能将“链接通过”描述为架构正确性证明。
