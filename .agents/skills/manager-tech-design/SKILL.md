---
name: manager-tech-design
description: Create a concise technical design for confirmed requirements, preserving stable contracts and milestone prerequisites without mandatory role dispatch.
version: 3.0.2
---

# 技术方案

遵守[共同流程](../MANAGER-WORKFLOW.md)。输入是已确认 PRD、现有架构与相关代码。

1. 优先引用仍有效的项目方案，不为每个 Change 重写总架构。
2. 在 `docs/technical/<area>/overview.md` 描述模块边界、数据/API 契约、关键流程以及适用的异常、权限、幂等和回滚策略。
3. 仅对高不确定性或跨模块功能追加专项章节/文档及关键伪代码；不生成逐行实现计划。
4. UI 部分按[设计输入接入](../ui-ux-delivery/references/manager-integration.md)读取相关 handoff/现有交互参考，区分 Current/Preserve/Delta；引用项目已有视觉规范、token 和公共组件。普通原型作为参考，不擅自升级为验收基线，也不要求先开浏览器才能设计。
5. 说明前序阶段产出和下游消费，区分已确定边界、待验证技术假设和真正待用户决定的产品行为。
6. 自查可实现性和可测试性。授权范围内的技术细节自动决策；实质产品/关键契约变化才集中说明并确认，可与 Plan 一次审核。

输出可供 Planner 使用的范围、依赖、必要来源与代码检查方式；必要时使用[方案模板](templates/overview.md)。
