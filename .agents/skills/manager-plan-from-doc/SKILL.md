---
name: manager-plan-from-doc
description: Plan confirmed requirements into dependent milestones and independently code-verifiable OpenSpec changes; preserve useful references and sparse human acceptance points.
version: 4.0.0
---

# 从文档规划

遵守[共同流程](../MANAGER-WORKFLOW.md)，先读[计划格式](references/plan-format.md)及[输入与拆分](references/input-contract.md)。只处理指定 PRD 范围，不覆盖无关计划。

1. 读取 PRD 全文、已确认决定、设计交付、技术方案和实际代码；按[设计就绪条件](../DESIGN-WORKFLOW.md#设计就绪与技术反馈)核对受影响范围。设计缺口不排成就绪计划或后续制稿 Change，返回准备；纯后端/轻量修改按共同规则处理。提取代码与人工验收，建立完整覆盖关系。
2. `planning=auto` 由 AI 判断：稳定边界一次排完整 M1～Mxx；探索部分保留问题与细化条件；用户明确 full/rolling 时按其偏好组织，不编造未决内容。
3. Change 按可独立检查的端到端意图划分，不按前端/后端/测试角色拆。上游须独立验证其契约，下游再验证自己的行为；禁止上游验收依赖尚未实现的下游页面。
4. 每个 Change 只归一个阶段。明确 Change 与阶段两层 depends_on；M1 的结果影响 M2 实现细节时保留该依赖，执行 M2 前用实际结果细化；若改变已确认交互，先走设计—技术反馈链，不将前期制稿推迟到 M2，也不重复全项目 Plan。
5. 单 Change 验收限定代码/逻辑与 UI 规范静态检查；真实视觉交互归阶段或最终人工验收。同一份 Plan 供 Execute 单阶段和 Run 连续执行；阶段代码检查由 Execute 完成。checkpoint 默认 auto。只有用户明确指定，或**缺少当前人工决定会使后续产品/交互/关键契约方向无法确定，或可预见造成大面积返工**时才设 manual，并在 note 写明待决定内容和受影响下游；“重要、高风险、有 UI、希望看效果、最终仍需验收”本身都不是 manual 理由。最终视觉待验使用 auto + pending。
6. 按[设计接入](../ui-ux-delivery/references/manager-integration.md)将同一需求级设计记录、真实文件/Frame/修订及必要状态定向关联实际 Change 消费者。已确认目标设计属于必需实现依据，不与可选风格参考混同；不创建制稿里程碑、重复 UI 清单或新的 Plan 字段。未生成来源不算有效证据。
7. 展示范围、阶段依赖、未知点和人工位置的简短预览。已有执行授权且不改变目标时写入计划，不逐 Change 请求批准；新产品范围先回 PRD review。
8. 使用只读 `scripts/check_plan.py <项目>/manager/plan.yaml` 检查本次计划，修正结构/循环/归属错误；检查脚本不证明需求完整或实际验收通过。

输出 Plan 与覆盖说明；不提前生成全部 OpenSpec 制品。已有 Change 的实质修改交 manager-revise-plan，不通过追加重复条目掩盖替换。
