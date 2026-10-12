---
name: design-qa
description: Verify an implemented page against a pinned Figma or Pencil design snapshot and approved project adaptations. Use independently or after design-to-code. Web capture supports React and Vue; native verification requires real platform evidence. Verification does not authorize source-design or production-code edits.
---

# Design QA

以同一设计快照、目标页面/状态和平台为锚，检查最终呈现及明确授权的行为。不是“脚本退出 0 即视觉通过”。默认只验证，修复由已有实现授权的调用方执行；绝不修改设计稿来匹配错误实现。

先读 [共同读取协议](../DESIGN-WORKFLOW.md#共同读取协议)，实际读取本次项目规则，并消费同一组件/Token 映射、业务状态与已批准宿主适配；缺来源不假称项目期望已核实。

1. 先确认当前 Change/task IDs（适用时）和实际验证范围，局部任务不扩大为全页验收；核对快照产物/hash、目标/平台、相关 Token/组件/代码标识和状态条件。变更使旧验收失效。缺基准图就报告 visual_checks=not_run，不借其他状态的图。
2. 按平台读取 [Web](references/web.md) 或 [原生](references/native.md)。React/Vue 共用浏览器采集；iOS/Android 需要各自原生证据。
3. 对齐内容锚点、逻辑尺寸、截图尺度和有效设计期望。同一稳定会话采集截图及测量；未知尺度不默认除以 2，也不拉伸图片强行对齐。
4. 按 [比较规则](references/comparison.md) 检查区块、顺序、布局、资产、排版、样式及实际状态，输出差异及证据。像素热力图只辅助定位，不独立决定通过。图片可由主线程或可选子代理审查，不强制子代理。
5. 调用方按既有授权修复 material 差异，再采集和复验；遵循 [共同停止条件](../DESIGN-WORKFLOW.md#验证与重试) 与调用方预算，检查本身不取得修复权。
6. 分别返回 code_checks/runtime_checks/visual_checks 的 passed、failed 或 not_run，附差异、适配/豁免、证据不足及剩余风险。无法对齐/未测量不是自动豁免通过。

普通 Manager Change 不自动追加浏览器门禁；按其检查授权和最终人工验收边界执行。不创建基线历史服务、另一套 Manager 状态或额外审批。

实现后按 [共同就绪与反馈规则](../DESIGN-WORKFLOW.md#设计就绪与技术反馈)核对基线及其变化，提供当前范围的实际运行、失败/恢复和视觉证据；前期设计接受不替代还原验证，报告只覆盖已检查页面与状态，不代签用户接受。

按 [最小交接字段](../DESIGN-WORKFLOW.md#最小交接) 交接，写清代码/组件/Token 语义审查、运行与视觉各自的真实范围；缺基线时可按授权审查项目界面规则，但不能报告设计还原 passed。
