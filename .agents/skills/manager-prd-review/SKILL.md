---
name: manager-prd-review
description: Review product behavior and acceptance before technical design or a scoped requirement revision; use only relevant read-only reviewers and require human rulings on product blockers.
version: 2.0.0-rc.1
---

# Manager 需求评审

按用户要求或高风险需求进入此环节。普通明确小修不召集完整评审会。
输入为具体 PRD 或受控修订范围；已有制品不意味着需求永远不能复审，需配合 manager-revise-plan 处理失效。

1. 读取当前范围、明确非目标、主要角色、输入和可观察验收。
2. 按实际影响选择 product-manager、QA，以及必要前端/后端/UI角色。只读工作可并行，不每次固定启动所有角色。
3. 合并重复问题。每个 BLOCKER 有位置、证据、影响、建议和需要用户裁决的具体问题。
4. 用户对产品问题裁决后再回写 PRD。不要把实现者偏好直接上升为需求。
5. 普通建议不阻塞小改动，除非影响实际验收或安全。只修有证据的问题，不无限扩大评审。
6. 通过后进入 manager-tech-design，或者在已存在且仍然适用的批准方案下继续规划。

输出：评审范围、角色结论、BLOCKER、建议、用户裁决、必要文档修订。
旧的 PRD 头部 review marker 可保留供阅读，但不是执行许可。批准依据是具体内容与真实决策引用。
新评审记录外置到 `manager/runtime/reviews/`，避免仅更新 marker 就使批准过的 PRD 内容变化。

## 共同边界

遵守 [Manager 总体工作流](../MANAGER-WORKFLOW.md) 和项目 AGENTS.md。这里只修改被明确授权的文件。
不修改第三方 CLI 生成的 OpenSpec Skills，不私自 git add/commit/push、部署、发布或归档。
归档目录永远不是普通修复的写入目标。状态只通过 plan_tool.py 修改。
真实工具、模型、浏览器或验证不可用时明确报告，不模拟已经执行。
