---
name: manager-run
description: Drive all remaining planned milestones by repeatedly calling the single-stage executor; respect dependencies and real human stops without duplicating implementation or checks.
version: 3.0.2
---

# 连续执行全部剩余阶段

先读[共同流程](../MANAGER-WORKFLOW.md)，按[计划格式](../manager-plan-from-doc/references/plan-format.md)解释当前项目。Run 只调度，manager-execute-current-batch 是唯一阶段执行入口，不创建独立运行状态机。

## 启动与恢复

`$manager-run` 从当前进度连续推进当前 Plan 中全部剩余已规划阶段；不提供 next、single 或 range 模式。只做一个阶段时使用 `$manager-execute-current-batch`。用户明确缩小授权时优先遵守限制，说明改用单阶段入口，绝不按默认全量扩大范围。
读取本地实际 Plan、progress、当前 Change 和工作区差异；远端空计划不能代替本地未提交计划。只确认尚不明确的范围和验证授权，不重复询问已覆盖事项。
没有计划时仅在用户也授权规划时调用 manager-plan-from-doc；空计划或 roadmap 未排期不报告为全部完成。只执行当前 Plan 不授权自动追加新需求。
复用仍有效的 PRD/技术确认。恢复前核对原执行者已停和既有副作用，沿同一进度继续，不重跑已完成实现；已有 code-verified 阶段仍须核对尚未满足的 manual/规划边界，不能因代码完成而略过。
按共同流程使用执行与审查两个职责：Execute 协调独立实现任务的并行分发并默认安排独立只读审查；用户明确 review=off 时省略审查。Run 不另行重复派发，不设置模型/权限或安装角色。

## 调度循环

1. 按 Plan 顺序选择前置条件已满足的阶段，只把一个阶段交给 manager-execute-current-batch。前置代码、明确人工停点和 planning_boundary 不能绕过；独立任务可在局部失败后继续，但仍遵守真实依赖、共享影响和用户明确顺序。
2. 读取 Execute 返回的阶段结果和 progress；实现、局部修复、阶段集成检查与阶段状态回写全部由 Execute 负责。Run 不重复实现、运行同一套检查或补写一个成功结果。
3. 阶段代码通过后，checkpoint 为 auto 或 manual 已真实接受时，继续下一阶段。本次明确 human_review=skip 或验收后移只按共同规则处理，仍保留 pending；必要产品决定不能被“跳过签字”代替。
4. Execute 的正常返回不是 Runner 的 STOP。局部阻塞时仅继续不依赖失败项且可安全隔离的已规划阶段；没有可执行工作时一次汇总原因，条件未变不重复调用失败阶段。
5. 全部阶段代码完成后汇总人工待验与剩余限制，不自动归档或发布。遇到明确人工点、真实阻塞、预算或用户停止时，保存下一步并结束。

普通调用可在当前会话前台循环；Goal 可按宿主能力分轮调用并复用同一进度，不假称会话外自动后台运行。

## 返回

简报已完成代码、实际检查、待人工体验、阻塞和下一步。最后一行使用：

- `MANAGER-RUN: CONTINUE`：已推进且还有可执行工作。
- `MANAGER-RUN: STOP(code-complete)`：全部已规划阶段代码检查通过，明确列出人工待验；不等于产品验收或归档。
- `MANAGER-RUN: STOP(human)`：到尚未满足的明确人工点，或继续会猜产品目标。
- `MANAGER-RUN: STOP(blocked)`：没有安全可执行工作，列出阻塞对象和解除条件；空计划/缺来源也不得冒充完成。
- `MANAGER-RUN: STOP(budget)` / `STOP(user)`：用户预算耗尽或用户停止。

这些是交接摘要，不是脚本解析的执行许可。新的明确继续请求可恢复；不能因为旧输出有 STOP 就重复索要“创建会话授权”，也不能据此跳过未满足的人工决定或清零修复次数。
