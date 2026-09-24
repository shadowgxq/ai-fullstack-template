# 计划预览：<范围>

## 来源与批准

产品文档、技术总/专项方案、真实人工批准引用、必要视觉基线；缺失项和可读性。
这些来源使用已有专用字段，不自动复制为 supporting Input。

## 规划策略

记录 requested（auto/full/rolling）、source（user/project/auto）、resolved（full/rolling/mixed），以及 1–3 条带来源的判断依据。
分别列出本次授权范围、已详细规划的批次、已定义但 blocked 的工作、roadmap 未排期范围和重新规划条件。用户覆盖不写回 policy；不把规划批准当作执行批准。

## 行为覆盖与归属

| 源子句 | 归一化行为 | Requirement | Owner change | 依赖 | 独立验收如何成立 |
| --- | --- | --- | --- | --- | --- |

给出总子句、去重后子句、已覆盖、blocked、未排期数量。远期范围只标识未排期，不能宣称已实现完整覆盖。

## Change 边界

| Change | 一句话意图 | 独立结果 | 为什么不是 task | 技术方案引用 | 风险 |
| --- | --- | --- | --- | --- | --- |

记录合并/拆分复核及20–25任务提示的处理，不机械执行阈值。

## 来源分类与输入去重

| 来源 | 声明位置 | 分类 | 去向/路由 | 消费者 | required / scope / snapshot |
| --- | --- | --- | --- | --- | --- |

分类使用：项目规范、源码调查、已有专用字段、真正 Input、重复/不消费。
确认规范仍经 AGENTS/角色路由读取；“下游输入”段也先分类。报告候选数、完整定义数、公共定义数和引用数。
同 id 同定义必须提升；异 scope/required/snapshot 不合并。共同定义只展示一次，不把 registry 展开抄进每个 Change。

## 批次、并行与停点

| Batch | Waves / depends_on | checkpoint | 依据及待人工裁决项 | planning_boundary |
| --- | --- | --- | --- | --- |

Full 可以有多个批次；rolling/mixed 明确哪些内容延后，不把所有功能塞进一个 batch。列出读写区、共享点、DB/端口等隔离证据；Change 与 task 并行分别说明。
推荐本次 manager-run 批次范围；其中 auto 检查点必须被真实执行授权覆盖，高风险与未决判断保留 manual。

## 写入差异与确认

追加/修改文件、保留内容和需要真实批准的事项；移除已解决的旧 planning_boundary 也必须列在此处，不顺手改其他活动状态。
用户批准后写入；运行 validate --strict-inputs 并核对 resolve-inputs。下一步区分“计划已写入”和“允许执行”，不假称已调用模型/实现代码。
