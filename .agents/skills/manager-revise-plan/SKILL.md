---
name: manager-revise-plan
description: Analyze and apply scoped product/design revisions with human approval, dependency invalidation and archived-change isolation; do not silently append a competing plan.
version: 2.0.0
---

# Manager 需求与方案修订

## 何时使用

正在做的要求变了、批准的方案需改变、change 范围要取消/替换，或者大规模 UI 调整属于新的视觉目标。
普通代码错误用 bugfix；不能为了修 bug 扩大本流程范围。

## 流程

1. 找到问题绑定的 requirement、技术方案、活动 change、输入与消费者。读取原文和实际实现，不只读取聊天摘要。
2. 区分 `code`、`design`、`requirement`，以及同目标修订还是新的交付目标。
3. `impact --change <ids>` 给出显式依赖闭包；再审查共享 requirement/contract/input 的消费者，补足根集合。脚本不能自动理解语义上的隐式依赖，发现后写成真实 `depends_on` 或明确范围。
4. 展示变更对比：旧目标、新目标、保留代码、失效任务、受影响消费者、验收与发布风险。已归档部分只读。
5. 用户确认前不改产品语义。确认后先停止受影响 Agent，核对实际线程终止，再释放 claim。旧线程结果不能混入新版本。
6. 同目标：`reopen --kind design|requirement --change <ids> --decision-ref <批准引用>`。工具递增 revision，清除相应批准与 gate，使下游重新验证。
7. 只修对应 PRD/技术方案和制品，保留仍然正确的内容。若 PRD 或技术内容变化，重新批准相应文档；不要批量重写全部历史。
8. 修改必要 acceptance、输入与依赖后运行 `validate --strict-inputs`；逐个消费者核对 `resolve-inputs` 的有效来源，重新检查条目归属和缺失范围。新 contract 会拒绝旧 Worker/Review/Gate 结果。
9. 新目标：生成新 ID，并通过 `cancel --change <旧ID> --decision-ref ...` 取消不再实施的旧项。记录替代关系，显式重新连接消费者；取消项不是完成依赖。
10. 已归档：创建新的 change，只引用旧基线。绝不 reopen、移动或编辑历史目录。

## 共享输入修订

遵守 [输入契约](../manager-plan-from-doc/references/input-contract.md)。影响分析同时检查 input_refs 和旧 inline inputs，不能只搜索局部定义。
修改顶层定义影响所有实际引用者；不自动广播到未引用者。只改变部分消费者的范围/版本时使用独立视图 ID，不能就地覆盖公共定义或求 scope 并集。
采用 normalize-inputs 的候选前核对旧 ID 引用与内容绑定；纯结构去重不改变产品语义，但不能假定旧审批/验证摘要仍有效。
不要把一次 Input 去重升级为重写全部 PRD 或方案；归档快照保持原样。

## 失效规则

行为或设计变化使当前 change 与受影响依赖消费者失效；不重排无关事项。
完整文件摘要是保守失效粒度：一个大 PRD 文件改动可能使引用它的多个批准失效。应优先按业务边界维护较小 PRD/专项方案；不能为减少重验偷偷忽略内容变化。
修订不自动 git reset、不删除已有实现、不自动恢复 cancelled、也不自动改变生产环境。
旧执行记录保留，新的 revision 重新开始任务图；同一 revision 的修复次数不因新对话而清零。

## 规划与运行边界的修订

按[规划策略](../manager-plan-from-doc/references/planning-strategy.md)只重判受影响范围。普通实现细节变化不要求重新规划所有后续 batch；用户本次参数不覆盖未授权的其他计划。
若探索结果已解决 planning_boundary，先展示来源/结论与新增范围；经批准后清除或移动该边界。不能为继续运行直接删除未解决事项，也不能把 manual 改为 auto 冒充产品验收。
批次定义、checkpoint 或规划边界改变时先收尾原轮次，再对新范围明确授权并创建 session；不隐式复活停止的 session。新范围的技术、制品与实际产品批准仍分别核对。

## 输出

变更影响表、批准来源、修订文件、失效范围、仍可复用部分、未决问题和下一轮的真实入口。

## 共同边界

遵守 [Manager 总体工作流](../MANAGER-WORKFLOW.md) 和项目 AGENTS.md。这里只修改被明确授权的文件。
不修改第三方 CLI 生成的 OpenSpec Skills，不私自 git add/commit/push、部署、发布或归档。
归档目录永远不是普通修复的写入目标。状态只通过 plan_tool.py 修改。
真实工具、模型、浏览器或验证不可用时明确报告，不模拟已经执行。
