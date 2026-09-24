---
name: manager-plan-from-doc
description: Plan PRD and technical designs with AI-selected planning depth or explicit auto/full/rolling overrides; preserve independently acceptable changes, shared inputs and separate execution approvals.
version: 2.0.0-rc.3
---

# Manager 从文档规划

## 定位与入口

只在用户明确要求从具体产品文档生成/追加计划时使用。修订已有需求用 manager-revise-plan，不能用追加计划掩盖替换关系。
读取 PRD、技术方案及批准证据、当前计划和相关活动 Change。只读必要主规格，默认不扫描归档。
支持 `planning=auto|full|rolling`；不传则由 AI 判断，mixed 仅作为 auto 的结果。用户自然语言中的明确规划偏好等价处理，不要求用户记参数。

必读：[规划策略](references/planning-strategy.md)、[拆分规则](references/planning-rules.md)、[输入边界](references/input-contract.md)、[兼容格式](references/manager-plan-schema.md)、[预览](templates/preview.md)。

## 执行

1. 判断工作类别：探索、小修、标准变更、高风险变更。不把小修硬塞进完整 OpenSpec 生命周期。
2. 正式变更应有总技术方案；复杂功能按需有专项方案。检查真实批准及其覆盖范围，不用新 Goal 或 planning 参数代替批准；未决内容明确标记，不编造成已批准结论。
3. 从本次主 PRD 全文抽取规范性行为子句，而不是只读 Acceptance 标题。拆开不同结果，保留源位置和必要限定；识别后续范围、验收与核心契约的真实不确定性。
4. 在拆分前运行 `plan_tool.py resolve-planning`，显式覆盖时传 `--planning <值>`。按“本次用户 > 项目配置 > auto”解析；AI 依规划策略给出 full/rolling/mixed 结果和简短证据。参数不改变需求事实、批准、输入义务或执行权限。
5. 建立验收归属：每个 Change 必须能用自身和显式依赖满足 acceptance，不能承诺尚未引入的未来页面。
6. 围绕可验收的端到端意图分组，运行五项边界测试和合并复核，再拆开无关意图。Requirement/capability/change/task 不要求一一对应；任务数只提示粒度检查。
7. 对显式来源逐项分类。项目规范走 AGENTS/角色路由，源码走任务调查，PRD/技术/UI 基线走专用字段；只把真实交付资料作为 supporting Input。台账记录分类、声明点、消费者和去向。
8. 相同 Input 多消费者只在顶层 inputs 定义一次，消费者写 input_refs；局部唯一输入兼容 inline。保留 shared/global locator，不合并不同 scope/required/snapshot，不按章节重复登记。
9. 按本次策略排批：full 覆盖明确授权范围的全部批次；rolling 细化最近里程碑；mixed 排入稳定部分、其余留 roadmap 并记录触发条件。没有“每次只能一个 batch”的限制，不提前生成四件套，不把全产品塞进一个大 batch。
10. Waves 依据显式依赖与真实隔离证据。另行建议每批 checkpoint 和必要 planning_boundary，说明人工停点原因；不能把规划模式当作跨批执行授权。Change 内并行独立由 execution DAG 决定。
11. 按预览模板展示策略来源、覆盖/未排期、验收归属、拆分理由、输入分类和数量、技术批准、依赖及停点。修复当前承诺范围内的遗漏/冲突；未知事实与待裁决项显式保留，不假称全部可执行。
12. 用户批准后按[写入检查](templates/plan-write.md)追加 requirements/openspec/batches，复用公共 Input，不覆盖其他消费者。可执行的新工作为 change/planned；缺关键前提的已定义工作为 change/blocked 并说明 blockers。只移除预览中已明确解决且获批准的旧 planning_boundary，不重写其他活动状态或历史。
13. 运行 `validate --strict-inputs`，逐 Change 用 resolve-inputs 核对 required/scope/snapshot 与预览。策略和全范围覆盖台账保存在 manager/runtime/planning/<id>.md，不修改已批准 PRD 正文/头部。

## 写入边界与交接

只写获批准的计划内容和外置覆盖记录，不生成 OpenSpec 制品、不实现代码、不归档。之后的 phase/state/review/current 由状态工具维护。
参数覆盖只影响本次规划，不自动改 policy；已有输入归并先预览，不能顺手重写活动条目或 AGENTS.md。
报告“已规划 / blocked / roadmap 未排期”各范围，给出 manager-run 的建议批次与停点；明确尚需的执行授权。需求/技术内容发生实质变化先走受控修订，不能由 Planner 自行改方案。

## 共同边界

遵守 [Manager 总体工作流](../MANAGER-WORKFLOW.md) 和项目 AGENTS.md。这里只修改被明确授权的文件。
不修改第三方 CLI 生成的 OpenSpec Skills，不私自 git add/commit/push、部署、发布或归档。
归档目录永远不是普通修复的写入目标。状态只通过 plan_tool.py 修改。
真实工具、模型、浏览器或验证不可用时明确报告，不模拟已经执行。
