---
name: manager-tech-design
description: Create the formal technical design from a confirmed PRD and ready UI/UX handoff when applicable; reconcile feasibility before planning without redrawing or duplicating the design.
version: 4.0.0
---

# 技术方案

遵守[共同流程](../MANAGER-WORKFLOW.md)，设计输入遵守[接入契约](../ui-ux-delivery/references/manager-integration.md)。输入是已确认 PRD、适用的设计交付、现有架构与相关代码。

1. 按[设计就绪条件](../DESIGN-WORKFLOW.md#设计就绪与技术反馈)核对当前范围。新页面/关键交互缺必要设计时不定稿，交回 UI/UX 准备；无 UI/轻量修改按共同规则跳过，已有有效稿与方案优先复用。
2. 实际读取需求级设计记录及相关 Pen Frame/状态/修订，核对搜索/分页、选择/提交、失败/权限、响应式和状态所有权等与本需求相关的交互约束。设计不改 PRD，路径存在不等于已读；不凭截图推断隐藏业务行为。
3. 在项目已指定技术方案位置维护模块边界、数据/API 契约、关键流程及适用的异常、权限、幂等/回滚；无既定位置时才用 `docs/technical/<area>/overview.md`。仅复杂部分展开，不为每个 Change 重写总架构。
4. 对照设计做可实现性/可测试性校验。局部技术细节在授权内决定；不可行交互或关键契约冲突按共同反馈链返回原协调者，修同一设计来源。产品行为变化先确认 PRD，只重核受影响部分，不擅改 Pen 或另建 UX 方案。
5. 引用设计记录/来源修订与项目组件/Token，不抄 UI 任务、样式表或 PRD。前序产出、下游消费及尚未验证假设写清；必要设计与技术一致后才向 Planner 交接。
6. 技术方案和 Plan 可同次确认，未变决定不重复签字；缺口不能写成已验证。输出范围、依赖、来源与代码检查方式，必要时使用[方案模板](templates/overview.md)。
