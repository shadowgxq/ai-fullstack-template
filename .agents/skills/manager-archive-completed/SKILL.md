---
name: manager-archive-completed
description: Archive explicitly authorized, code-verified changes after required human acceptance using the installed OpenSpec CLI; never rewrite existing archive history.
version: 4.0.0
---

# 显式归档

遵守[共同流程](../MANAGER-WORKFLOW.md)。Execute/Run 代码完成都不触发归档；归档、提交 PR、合并和发布授权分开处理。

1. 确认本次归档对象、代码检查和所属阶段检查均通过；有 requirement.human_acceptance 的条目或明确 manual 点，必须有对应真实人工验收。code-verified 不是产品验收；不得用 human_review=skip 代写 accepted。
2. 检查 tasks 无未完成必需工作，工作区没有他人写入，历史归档没有未说明修改；保存当前 Git diff/路径作为核对依据，并解析本次待移动文档的本地链接目标（包括 design.md 的 Pen/任务来源）；不新建 ticket 或 seal。
3. 使用本机 OpenSpec 原生 archive 命令；有明确归档授权时可使用实际 CLI 支持的 --yes，但不跳过验证、不手工伪装目录移动成功。
4. 成功后核对活动目录、新归档、主规格及旧历史 diff。移动改变相对路径时，只在本次新归档中重算受影响的相对链接，保留目标语义与锚点：同次移动的内部目标跟随新位置，项目外部目标保持原位置；更新本次已知活动消费者引用，不改旧归档历史或设计内容。回读链接与必要主规格验证通过后再收尾。部分失败保留现场及已发生操作；目录已移动而引用未修复时记待修复，不盲目重复 archive。
5. 最后将 Change 标 archived 并记录 archive 路径。Plan 保留仍被依赖的已归档条目，不为简短清单删除依赖；用户要求清理时先重连真实来源再处理。

若逻辑或人工验收未完成，记录待办并继续其他已获授权的归档对象，不把缺项归档后再补。
