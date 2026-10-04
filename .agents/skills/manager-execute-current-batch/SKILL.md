---
name: manager-execute-current-batch
description: Execute exactly one planned milestone; coordinate parallel subagents for independent Changes or tasks, complete code checks and independent review, then return. Use manager-run to continue the plan.
version: 3.0.2
---

# 单步执行一个阶段

遵守[共同流程](../MANAGER-WORKFLOW.md)及其人工边界。这里的“一步”是一个 Batch/Milestone，不是一个 Change；独立调用和 Runner 调用使用同一套实现与验收。
必读[代码与逻辑验收](references/verification.md)及[代码审查](references/code-review.md)；用户明确 review=off 时省略独立审查。

## 选择一个阶段

用户或 Runner 指定阶段时只选该阶段；未指定时先恢复 progress 中尚未完成的阶段，否则按 Plan 顺序选择首个未完成阶段。先核对本地 Plan、真实进度、前置代码检查及相关人工/规划边界；不因指定 M2 就补做未授权的 M1 或绕过其未满足条件。
选定后本次范围固定为一个阶段；指定已完成阶段时复用有效结果，不重做。全部阶段代码已通过时仅汇报现状与人工待验；指定未知阶段或多个阶段时说明单阶段入口的范围问题，不自行扩大授权。

## 阶段内执行与收尾

1. 从该阶段识别所有依赖已满足的 Change，读取本轮可执行项的需求、技术方案、相关 Inputs 和项目规范；UI 设计输入按[接入契约](../ui-ux-delivery/references/manager-integration.md)定向消费，核对相关 Surface/保留项/任务语义，不从 Schema 重新发明交互；不全量扫描归档或无关源码。
2. 检查实际安装的 OpenSpec commands/skills/schema。用原生 propose/update/apply 或实际版本提供的等价动作；不假设 ff/verify 已安装，不修改第三方 Skill。
3. 各就绪 Change 到执行时才细化所需制品，基于前序已完成代码；将相关设计引用和关键用户任务写入现有 design/规格，确认 Apply 能读取后，对齐需求与 acceptance 直接进入实现，不默认在 Change→Apply 间再请求签字。未变的方案只引用。
4. 当前会话协调同一 batch 内多个就绪 Change，或同一 Change 内独立任务，按共同流程派原生通用 subagent 并行实现；依赖或读写冲突的部分按顺序处理。交接明确范围、输入与检查授权，协调者核对真实 diff 和直接消费者，统一回写 tasks.md，保留用户已有改动。
5. 按 verification.md 自查 diff、逻辑与 UI 代码规范，执行最小必要检查。可用原生 `openspec validate <id> --strict --no-interactive` 检查制品；同一未变制品不因阶段切换重复校验。
6. 有问题定向修复并复验；无法完成时记录 blocked 和影响范围，继续本阶段内能安全隔离的独立工作。不能删验收、弱化断言或用假数据宣称真实能力成立。
7. 每个 Change 完成必要代码检查后，即交独立只读 Reviewer 审查其稳定的 diff、契约与证据；用户明确 review=off 时省略。审查该范围期间，其他就绪且读写互不冲突的任务可继续执行。必要检查与所需独立审查通过后，协调者立即回写该 Change code-verified 并释放下游依赖，继续调度本阶段新就绪项；发现问题时先修复、复验并定向复查。全部成员完成后，本入口补阶段必要的接口/数据/代码集成检查及新增 diff 审查，复用有效结果；成功才将阶段标记 code-verified。verify-report.md 保留真实检查、审查结果与人工待验；失败或环境缺失保留实际未完成项，不让 Runner 代补收尾。
8. 保存 Plan 摘要与 progress，返回阶段 ID、成员/阶段代码检查结果、阻塞、人工待验和下一步建议。已通过且相关条件未变的结果复用；被请求重验的阶段只补受影响检查。

## 返回边界

无论 checkpoint 是 auto 还是 manual，单次调用完成该阶段后必须返回；阶段内无安全可执行工作时也返回实际未完成原因。即使下一阶段已就绪，也不得自动进入、创建其制品或调用 manager-run。
这是一次单步调用的正常结束，不是整个 Plan 完成或 Runner 的停止指令；是否继续下一阶段只由外层 Runner 或用户决定。返回和“继续”本身不代表人工验收，不能代写 accepted。
不使用浏览器、截图、Computer Use 或视觉自动化作为单 Change 或阶段代码验收条件；显式要求实际交互证明的产品条目交人工验收，不擅自改成静态通过，不自动归档。
