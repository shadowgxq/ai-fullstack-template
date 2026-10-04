---
name: manager-plan-from-doc
description: Plan confirmed requirements into dependent milestones and independently code-verifiable OpenSpec changes; preserve useful references and sparse human acceptance points.
version: 3.0.2
---

# 从文档规划

遵守[共同流程](../MANAGER-WORKFLOW.md)，先读[计划格式](references/plan-format.md)及[输入与拆分](references/input-contract.md)。只处理指定 PRD 范围，不覆盖无关计划。

1. 读取 PRD 全文、已确认决定、技术方案和实际代码；提取 Requirements 的代码验收与人工验收，建立完整覆盖关系。
2. `planning=auto` 由 AI 判断：稳定边界一次排完整 M1～Mxx；探索部分保留问题与细化条件；用户明确 full/rolling 时按其偏好组织，不编造未决内容。
3. Change 按可独立检查的端到端意图划分，不按前端/后端/测试角色拆。上游须独立验证其契约，下游再验证自己的行为；禁止上游验收依赖尚未实现的下游页面。
4. 每个 Change 只归一个阶段。明确 Change 与阶段两层 depends_on；M1 的结果影响 M2 设计时保留该依赖，执行 M2 前用 M1 实际结果细化，不重复全项目 Plan。
5. 单 Change 验收限定代码/逻辑与 UI 规范静态检查；真实视觉交互归阶段或最终人工验收。同一份 Plan 供 Execute 单阶段和 Run 连续执行；阶段代码检查由 Execute 完成。checkpoint 默认 auto。只有用户明确指定，或**缺少当前人工决定会使后续产品/交互/关键契约方向无法确定，或可预见造成大面积返工**时才设 manual，并在 note 写明待决定内容和受影响下游；“重要、高风险、有 UI、希望看效果、最终仍需验收”本身都不是 manual 理由。最终视觉待验使用 auto + pending。
6. 按[UI/UX 接入契约](../ui-ux-delivery/references/manager-integration.md)自动判断设计适用性。用户已直接提供 Prompt、UI 图、Figma、HTML/原型等明确设计输入时，直接登记为相关 Change 的 `reference`，不为了形式完整而补跑 ui-ux-delivery/UX；只有已授权且确需生成设计时使用 handoff 终点。普通小改不启动完整流程，不新增必填 Gate。参考资料按相关性关联；一个共享资料只定义一次。没有项目视觉规范时使用现有实现，不新建 token/组件强制体系。
7. 展示范围、阶段依赖、未知点和人工位置的简短预览。已有执行授权且不改变目标时写入计划，不逐 Change 请求批准；新产品范围先回 PRD review。
8. 使用只读 `scripts/check_plan.py <项目>/manager/plan.yaml` 检查本次计划，修正结构/循环/归属错误；检查脚本不证明需求完整或实际验收通过。

输出 Plan 与覆盖说明；不提前生成全部 OpenSpec 制品。已有 Change 的实质修改交 manager-revise-plan，不通过追加重复条目掩盖替换。
