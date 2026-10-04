# 输入与 Change 边界

Requirement / Acceptance 决定产品行为；已确认方案约束关键契约；项目规范约束代码。普通原型、HTML、截图是参考，除非用户明确将其指定为验收标准。

PRD 由 requirements.source 定位，方案由 technical_design 引用；工程规范从 AGENTS.md 定向读取，源码按任务调查。真正的共享契约、数据或参考资料在顶层 inputs 定义，实际消费者使用 input_refs，不把所有资料广播给每个 Change。
Input 保留 source、purpose（contract/reference）、required 及必要 scope。required 只表示是否缺失会影响执行，不自动改变来源权威。相同来源的不同消费范围可用不同 ID；可选参考存在时应阅读，缺失时说明而不停止。
读取当前消费者需要的源位置及共享约束。远程资料使用真实可访问来源；缺少上游产物先执行生产者，不编造快照。普通参考调整不要求重新批准整个计划；变化影响行为或契约时检查全部真实消费者。

每个 Change 应有一个明确可验收意图。前端、API、持久化、相关测试通常是同一 Change 的内部任务。只有契约本身可独立使用/测试或存在独立风险边界时，才拆成基础 Change；不能仅因“可复用”就拆层。
拆分后检查相邻项：是否互相依赖才能证明完成、是否把同一用户事务拆散、是否缺少失败/权限路径；需要时合并。不要按固定任务数量或 Agent 数量划分。
人工观感验收与代码验收分开归属，但不删除产品要求；普通参考不是硬视觉基线，明确基线也不自动要求逐 Change 浏览器取证。

UI/UX handoff 使用同一 inputs/input_refs 机制，默认 purpose=reference，scope 指向受影响 Surface；required 取决于真实依赖，不自动变为人工 Gate。普通 HTML/截图无需强制转换。来源有效性与消费边界见[接入契约](../../ui-ux-delivery/references/manager-integration.md)。
