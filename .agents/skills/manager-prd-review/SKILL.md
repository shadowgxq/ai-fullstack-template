---
name: manager-prd-review
description: Review a specified PRD and obtain human confirmation of product scope before planning; reuse unchanged confirmed decisions.
version: 3.0.2
---

# 需求评审

遵守[共同流程](../MANAGER-WORKFLOW.md)。当前会话完成评审，不召集固定角色。

1. 全文读取当前 PRD 和必要现状，提炼用户目标、非目标、角色权限、正常/失败路径及可观察的验收条件。
2. 检查遗漏、冲突、未来能力依赖和输入真实性；实现细节自行比较，产品行为的不确定性不能凭空决定。
3. 合并重复问题，按影响给出最小修改建议。用户明确要求先审核时，不生成业务代码。
4. 给出简短结论与需要决定的问题，等待一次人工确认；已有明确批准且内容未变则直接复用，不重复询问。
5. 将确认范围、日期和真实消息/评审记录位置记在现有评审文档或 `manager/progress.md`。仅有 AI 评审不得写成人工通过。

交接给 manager-tech-design；已有有效方案可直接进入 manager-plan-from-doc。不改需求来迁就错误实现。
