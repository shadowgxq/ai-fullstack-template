---
name: manager-bugfix
description: Repair a reported deviation with minimal write scope, persistent budgets and exact artifact backwrite ownership; distinguish code defects from new requirements and archived history.
version: 2.0.0-rc.1
---

# Manager 修复

## 分流

先明确 expected/actual、复现步骤、环境、证据和归属。无法复现时做定向调查，不进行大范围猜测修改。

| 类型 | 路径 |
| --- | --- |
| 当前 change 的实现偏离正确要求 | 原 change 内代码修复，默认不改 Spec |
| 方案自身有误，行为目标未变 | manager-revise-plan 修 design/tasks，重新确认必要决策 |
| 用户改变目标/要求 | manager-revise-plan，不假装成 bugfix |
| 已归档行为需要变化 | 新 active change；旧 archive 永久只读 |
| 无行为变化的局部小修 | 现有 repairs/repair-intake/repair-runner，保留最小复现和验证 |

[回写矩阵](references/backwrite-matrix.md)、[根因清单](references/root-cause-checklist.md)、[记录模板](references/finding-template.md)。

## 代码修复流程

1. 定位最小失败路径和正确验收，必要时先补会失败的回归测试。
2. 对已 archive-ready 但尚未真正归档的 change，使用 `reopen --kind code --decision-ref <问题引用>`；blocked 也须受控 reopen，不用 start 直接解锁。
3. 重新 start apply。自动修复在已 in-progress apply 内执行，不重复 reopen、不重置尝试次数。
4. `repair-begin --change <id> --finding <稳定问题ID> --allow <代码/测试路径>`。默认 code-only，禁止把 docs/spec/manager 设为允许区。
5. 派对应 Worker 定向修复。超出范围必须暂停说明根因，不允许修复者任意修改需求、跳过测试、更新视觉基准。
6. `repair-finish --key <返回key>` 检查真实修改范围和 contract 未变。违规后 block，保留工作供审查，不自动 reset 丢失用户修改。
7. 局部检查先定位问题；最终要重新跑当前 change 的完整 gate，包括独立 Review 和实际交互。不能把一次针对性单测当最终完成。
8. 最多两次自动修复，计数跨 Goal 重启持久化。同一问题不能改名骗过预算；无法继续时升级根因/产品决策。
9. 记录根因、代码与测试修改、是否需制品回写、实际检查结果。纯代码错误明确写 `No artifact backwrite required`。

## 特别规则

重大重构不能无限塞进修复回路：目标不变但架构需变，先走 design revision；目标变了则新需求。
“实现后觉得不够美观”先判断是偏离已批准基线还是新的视觉偏好；后者走 UI 基线修订，不要不断重写业务 Spec。
记录 findings 在活动 change；归档后新问题记录在新的修复项，绝不向旧 archive 追加 findings。

## 共同边界

遵守 [Manager 总体工作流](../MANAGER-WORKFLOW.md) 和项目 AGENTS.md。这里只修改被明确授权的文件。
不修改第三方 CLI 生成的 OpenSpec Skills，不私自 git add/commit/push、部署、发布或归档。
归档目录永远不是普通修复的写入目标。状态只通过 plan_tool.py 修改。
真实工具、模型、浏览器或验证不可用时明确报告，不模拟已经执行。
