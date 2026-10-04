---
name: manager-revise-plan
description: Revise only affected requirements, contracts, milestone dependencies and checks; preserve completed code and obtain decisions only for material product changes.
version: 3.0.2
---

# 需求与方案修订

遵守[共同流程](../MANAGER-WORKFLOW.md)，读取[输入与拆分](../manager-plan-from-doc/references/input-contract.md)。

1. 判断是实现错误、局部技术调整还是产品/关键契约变化。实现错误用 manager-bugfix；局部技术调整在授权内直接决定。
2. 设计输入变化按[UI/UX 接入契约](../ui-ux-delivery/references/manager-integration.md)判断实质影响；仅布局/组件替换不重新批准整个计划。
   从 Change depends_on、阶段 depends_on、共享 requirement/input 和实际消费者识别影响，保留不相关的工作。
3. 产品变化用“原目标 → 新目标 → 影响”集中说明，取得必要真实决定；已有明确用户修改请求不再次重复确认。
4. 核对受影响执行者已结束后，定向更新计划和实际 OpenSpec 制品；现有代码按价值保留，重新检查受影响部分而非从头重做。
5. 受影响代码检查标为待复验；改变人工验收对象时对应 human_acceptance 回 pending。取消/替换时显式调整依赖，不把删除条目当成成功。
6. 运行[只读计划检查](../manager-plan-from-doc/scripts/check_plan.py)，记录修改与恢复下一步，交回原调用方，不自行启动 Run 或扩大单阶段范围。归档记录不回写；需要变化则建新活动 Change。
