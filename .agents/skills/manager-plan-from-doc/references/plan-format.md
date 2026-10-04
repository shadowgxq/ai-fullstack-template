# 当前 Plan 格式

只维护一份 `manager/plan.yaml`。新格式不带自定义 session、执行凭证或旧版枚举；LLM 直接维护，结构示例见[模板](../../templates/project/manager/plan.yaml)。

| 字段 | 含义 |
| --- | --- |
| requirements | id、source、code_acceptance；可选 human_acceptance，保留对应产品/视觉条目 |
| inputs | 可选的共享 id/source/purpose/required/scope；只给实际消费者 |
| openspec | id、requirements、depends_on、status；可选 technical_design、input_refs、note、archive |
| batches | id、depends_on、changes、checkpoint、status、human_acceptance；可选 checks、decision_ref、note、planning_boundary |

Change status：`planned`、`in-progress`、`code-verified`、`blocked`、`archived`。
Batch status：`planned`、`in-progress`、`code-verified`、`blocked`。阶段 code-verified 由 Execute 在全部成员和本阶段必要代码集成检查通过后回写，不表示产品验收；Run 读取该结果，不补做另一套收尾。
human_acceptance：`pending`、`accepted`、`not-required`。有人工验收要求时不能用 not-required；accepted 必须附真实 decision_ref，文本不证明身份认证。
checkpoint：默认生成 `auto`；Run 在阶段代码通过后继续，Execute 仍正常返回。`manual` 只用于用户明确指定，或缺少当前人工决定会让后续产品/交互/关键契约方向无法确定、或可预见造成大面积返工的节点；note 必须写明待决定内容及受影响下游，已 accepted 不再重复停。重要、高风险、有 UI、希望看效果或最终仍需人工验收本身都不构成 manual；这类不影响后续编码的验收使用 auto + pending。

## 依赖与完成

- Change 依赖的代码必须 code-verified 或 archived 才能用于实现；不得以 blocked 或取消代替完成。跨阶段的 Change 依赖必须同时体现在阶段的传递依赖中。
- 两个入口都核对前置阶段代码检查及相关人工/规划边界；指定下游阶段不授权补做前置或绕过它。manual 前置必须真实接受，除非本次用户明确延后该验收且不存在尚未决定的产品前提；延后仍 pending，不能伪造 accepted。
- `planning_boundary` 保存真实未决内容。技术结果已明确且仍属授权范围，可由 Planner 细化；改变产品目标或超出仅执行当前 Plan 的授权时等待决策。
- 全部代码通过可汇报“代码阶段完成”，人工 pending 汇报“待人工验收”。全部人工验收满足后才可宣称产品已验收。
- 归档是独立动作。archived 必须有真实归档路径；不删除仍被依赖的条目，不引入另一份历史依赖索引。

## 最小记录

每个活动 Change 的 verify-report.md 记录代码/逻辑检查、独立审查结果、静态 UI 规范检查、实际命令/结果、待人工项和修复次数，格式自由；短任务不用生成多个 JSON/日志/hash 文件。tasks.md 只勾实际完成的实现与代码检查项；产品人工验收集中由本表的 human_acceptance 记录，不能混入实现完成复选框。
`manager/progress.md` 由两种入口共用，保存授权、当前 M/Change、检查索引、人工待验、阻塞/修复次数和下一步，不记录模式或会话状态；Plan 的摘要状态不复制每个 task。结构检查在计划写入/实质修订后执行，不要求每个命令前后执行。
UI/UX 交接沿用 inputs.source + purpose=reference + scope 与 Change.input_refs，不增加 uiux_gate、ui_baseline 或另一份状态机。示例与设计完成/产品验收区分见[接入契约](../../ui-ux-delivery/references/manager-integration.md)。
