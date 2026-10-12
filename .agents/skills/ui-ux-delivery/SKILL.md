---
name: ui-ux-delivery
description: 在正式技术方案前，从已确认 PRD 完成一体化 UI/UX 设计交付；协调 pencil-design 实际制稿并返回同一设计来源，不创建代码或 OpenSpec 任务。
metadata:
  author: quick-web-service-hub
  version: 5.0.0
---

# UI/UX 设计交付

阶段、就绪、代表页与反馈规则唯一见 [设计工作流](../DESIGN-WORKFLOW.md#执行范围)，读取项目按 [共同读取协议](../DESIGN-WORKFLOW.md#共同读取协议)。UI 与 UX 一次交付，不增加独立原型阶段；实际制稿交 `pencil-design`。

## 执行

1. 全文读取已确认 PRD 和必要现状，明确本次需求范围、主路径、失败/恢复、保留项和非目标；沿共同范围规则复用适用稿或跳过无需制稿的工作。尚无 Change 是正常前置阶段，不要求 Change/task IDs。
2. 查项目现有架构、组件/API、Token、平台和数据/权限约束，标明当前能力与目标能力。只做必要可行性检查，不预写正式技术方案，不将新交互悄悄当作已确认产品行为。
3. 用 [任务模板](templates/pencil-task.md)在项目现有设计文档位置维护一份需求级设计记录；任务正文和后续交接同源更新。当前范围的页面、动作和必要状态引用 PRD，具体样式交 pen.dev，不复制业务规则或另建 UI/UX 两套文档。
4. 需要制稿且已授权时实际加载 [pencil-design](../pencil-design/SKILL.md)，通过可用设计工具完成代表页、取得必要反馈，再完成当前确认范围其余稿件。完整是本次需求，不是未来整个产品；不创建 OpenSpec 制品、后续代码或平行任务清单。
5. 按 [设计就绪与技术反馈](../DESIGN-WORKFLOW.md#设计就绪与技术反馈)核对全部本次范围并更新同一记录：真实文件/Frame/修订、状态覆盖、项目映射、实际检查、接受范围和缺口。任务说明或截图存在不等于完成。
6. 按 [最小交接](../DESIGN-WORKFLOW.md#最小交接)返回原协调者；就绪交给 `manager-tech-design` 消费。技术反馈仅修受影响部分，已有任务时按 [接入契约](references/manager-integration.md)同步引用；保留技术方案其他章节，不复制设计正文进 Change。

## 返回边界

只请求文档则输出执行任务后返回，不操作设计工具；正文仍明确 pen.dev 接收后应实际制稿。只请求设计则到设计交接结束，不自动执行技术方案或开发。完整交付由原协调者按 Manager 主线继续，不由本 Skill 接管全量实现。

工具、来源或必要接受缺失时如实记录未完成项，不转为 Execute 中稍后制稿。设计协作者不勾 `tasks.md`，不更新 Plan 或产品 `human_acceptance`；实际设计接受不是代码/运行/产品通过。
