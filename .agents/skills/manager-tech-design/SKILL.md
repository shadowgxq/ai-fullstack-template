---
name: manager-tech-design
description: Create or revise a PRD-grounded hierarchical technical design with core flows and pseudocode; require human approval before formal change execution.
version: 2.0.0-rc.3
---

# Manager 技术方案

## 定位

新增 PRD → 技术方案 → 人工评审 → change 规划这一环。总方案回答当前功能集合如何实现，复杂任务有专项方案。
不是先做覆盖全产品未来所有功能的大设计，也不为每个按钮复制一份方案。

## 输入与输出

读取明确提供的产品文档、相关现有代码、已批准架构/视觉基线，以及显式声明的接口和数据资料。
输出 `docs/technical/<area>/overview.md`；仅对高不确定性、跨模块、迁移、安全或复杂算法部分增加 `features/<feature>.md`。
模板：[总方案](templates/overview.md)、[专项方案](templates/feature-design.md)、[评审记录](templates/review.md)。

下游交接遵守 [输入契约](../manager-plan-from-doc/references/input-contract.md)：分别列已有专用来源、真正交付输入、项目规范/源码调查路由。
不要将规范、当前源码目录、package.json 或环境示例混进“必需 Input”清单；同一公共资料列一次并说明消费者。不把方案自己再声明为自己的 Input。

## 流程

1. 建立产品行为清单：范围、非目标、角色权限、成功/失败状态、性能与数据保证。未决定的产品行为不得写成既定事实。
2. 定向读取现有代码。可并行派 explorer 查前后端边界，QA 查可测试性，UI reviewer 查已有组件；主线程只收路径、风险和简短证据。
3. architect 给出总体结构、主要模块/接口契约、核心业务流程和必要的伪代码。必须包含失败/重试/幂等/回滚等适用路径。
4. 复杂功能单独展开，明确上位方案引用、输入输出、状态转换、不变量、关键数据结构与算法。不重复抄写总体方案。
5. 新 UI 模式先有可运行代表性页面或已确认设计稿；核心状态和真实内容必须可检查。后续同类页面复用基线。
6. 对方案进行可实现性与可测试性审查，列出风险和待决事项。外部库/API 的具体用法要查当前官方资料。
7. 展示简短方案摘要、核心流程、最重要伪代码和人工决策项，等待用户批准。批准应绑定文件内容，不是只有“通过”两个字。
8. 根据真实批准记录执行：

```bash
python3 <execute-skill>/scripts/plan_tool.py --plan manager/plan.yaml approve-technical \
  --document docs/technical/<area>/overview.md \
  --source docs/prd/<feature>.md \
  --decision-ref '<真实人工批准消息/评审记录引用>'
```

每个被 change 引用的专项方案也记录批准，source 必须覆盖该方案服务的 PRD；已批准、内容未变的总体方案可以复用。
UI 基线也可用同一批准命令记录：document 指向基线文档，source 指向其 PRD。

## 交给 Planner 的确定性信息

简短列明稳定的行为/验收/契约，以及尚未验证的数据、接口、产品方向、视觉或关键技术假设；说明哪些后续工作依赖这些结果。风险高与需求不明确分开记录。
由 manager-plan-from-doc 在读完行为来源后、拆 Change/Batch 前按[规划策略](../manager-plan-from-doc/references/planning-strategy.md)判断。技术方案不强制“一个 batch”，用户的 planning 参数也不把假设变成已批准事实。
探索结果未定时，只批准可独立确认的范围与探索目标，保留未决范围；后续细化不要求重写仍有效的总方案。

## 减重规则

局部明确 bug、文案、已批准视觉体系内的小间距修复走轻量 repairs，无需新技术方案。
代码少不等于低风险：权限、支付、隐私、数据迁移仍要方案审查。
总方案覆盖已明确、已批准范围的稳定架构与关键契约，可跨多个里程碑；不是未来所有 changes 的逐行实现说明。
OpenSpec design 只写本次差异、引用和必要决策，不能把这里的整份方案重新生成一遍。

## 验收

必须能从每个正式行为找到实现边界和验证方式；伪代码能表达主要决策/错误路径，而非逐行翻译未来代码。
没有未裁决的阻塞问题；引用的真实输入可访问；文件变更会使批准失效。
批准凭证是流程约束，不是身份认证，不能由 Agent 凭空填写“用户已同意”。

## 共同边界

遵守 [Manager 总体工作流](../MANAGER-WORKFLOW.md) 和项目 AGENTS.md。这里只修改被明确授权的文件。
不修改第三方 CLI 生成的 OpenSpec Skills，不私自 git add/commit/push、部署、发布或归档。
归档目录永远不是普通修复的写入目标。状态只通过 plan_tool.py 修改。
真实工具、模型、浏览器或验证不可用时明确报告，不模拟已经执行。
