## Context

M1、M2 已 code-verified。依赖实际收藏/分组 DTO、用户锁与持久回执，来源为 [正式技术方案](../../../docs/architecture/bookmarks/overview.md) 和 [PRD](../../../docs/product/bookmarks-prd.md)。前阶段来源已恢复为独立 headless saved-file 观察；代码基线在 `/home/gxq/.cache/bookmarks-run-20261013/m2-baseline`，供独立增量审查。

## Goals / Non-Goals

交付当前页批量整理及完整工作流代码检查。复用既有数据模型和恢复协议；不增加跨页选择、拖拽、分享、设计稿或新的通用状态引擎。产品/视觉仍 pending。

## Decisions

`POST /api/v1/bookmarks/batch-move` 接受 1–10 个互异 UUID `bookmark_ids` 与可为 null 的 `target_group_id`，要求 UUID Idempotency-Key。kind 为 `batch_move`，成功 `resource_id=null`，`changed_count` 只计归属实际变化的行，可以为零。固定动作路由先于 `/bookmarks/{id}`，前端 runtime parser/metadata 恢复同步兼容。

复用每账号锁、savepoint 与终态回执；全部源和目标均验证当前 owner，失效统一 40914，不泄露其他账号内容。请求 hash 对 IDs 排序，目标参与 hash；保持 M1/M2 已有 hash 协议。验证完成后只更新实际变组的行，使用锁后同一个 clock_timestamp；同目标行不写时间。用户锁保障移动与编辑/删组共享序列，真实 PG 验证两个锁顺序、失效、重复 key/resolve 与中途回滚。

前端选择集合只属于当前实际页；筛选、页码与历史变化清空，加载时不得把旧筛选行当当前页。批量意图保存当前 IDs/目标直到明确结果；pending/unknown 不重发、不允许新动作套用旧恢复对象。明确失败后刷新并保留当前页仍有效的选择交集，unknown 必须按原 key resolve，不能因传输错误生成新 key。成功清选择并刷新，由服务端页码校准；刷新失败反馈仍区分已写入与读取失败。

### UI 实现依据

消费 [同一设计交付](../../../docs/design/bookmarks-design.md)，Pen SHA `234a29969acacf918dd86d0e80bc5d30865c4077d5becd3d139e28dc6f1feb66`；当前 task 2.1–2.2 绑定 `EapSM/fISvK`、`mJdGV` 批量区、`I5Qsg` 失败/unknown，以及 `frGCk/U596kS` 列表/页码刷新。由 design-to-code 增量实现，真实 shared Checkbox/Select/Button 等 API 与 Token 为准，不按文案复制反馈组件。使用原执行者 headless reader 按需观察/prepare，完成前新实现 CAS/release；不得伪称当前 editor 的另一个项目为此稿。

## Risks / Trade-offs

- 选择与查询状态切换、服务端页码回退不同步 → 相邻组件/历史/延迟响应回归，只让当前有效页参与操作。
- batch 成功 resource_id 为 null 被旧 parser 拒绝 → 各终态组合与 kind 直接消费者测试。
- 任一对象失效或异常部分写入 → 所有验证和变更在既有事务/锁内，真实 PostgreSQL 故障注入与 HTTP 集成。
- 分组集合大小无已确认上限 → 完整返回不截断，定向真实 PG 大集合记录查询时间，不设脆弱计时门槛或擅自缩小产品范围。

## Migration Plan

无需新表或迁移；模型/schema 漂移检查继续有效，生产操作/提交/归档均不在本次授权内。

## Open Questions

无未决产品决定。完成后汇总 PRD 6 和两主题/1440/390/键盘等人工待验，不用代码检查代写 accepted。
