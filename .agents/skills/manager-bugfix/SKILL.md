---
name: manager-bugfix
description: Fix a concrete implementation deviation and recheck affected code without changing correct requirements or introducing a repair workflow.
version: 3.0.2
---

# 实现修复

遵守[共同流程](../MANAGER-WORKFLOW.md)、[代码验收](../manager-execute-current-batch/references/verification.md)与[独立审查](../manager-execute-current-batch/references/code-review.md)。

1. 对照预期/实际、来源和复现定位问题；环境失败与代码缺陷分别记录，不猜测性大重构。
2. 在当前活动 Change 内修代码和相关测试；正确需求不改。实现目标或关键设计确需变化时转 manager-revise-plan。
3. 代码变化影响已完成项时，将相关 Change/阶段代码状态标回 in-progress，并清楚标明待复验；保留正确实现，不重置整份 tasks 或重复全部工作。
4. 只复验修复及受影响消费者；改变已审查 diff 时交独立 Reviewer 定向复查，用户明确 review=off 时省略。记录根因、修改、检查/审查结果和尝试次数；所需检查与复查完成后恢复真实代码状态，否则保留待完成项。交回调用方，由 Execute 继续本阶段收尾，Run 据返回结果调度。独立调用只返回修复结果，Bugfix 不启动后续阶段。
5. 归档后出现的新问题使用新活动 Change，不能修改旧验收历史。

普通小修可直接修，不自动转入 repair-intake/repair-runner；它们只在用户显式调用时使用。
