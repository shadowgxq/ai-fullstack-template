# 规划策略与执行边界

## 在哪里判断

由 manager-plan-from-doc 读取本次 PRD 全文、技术方案、现有代码边界及批准证据后，在 Change/Batch 拆分前判断。manager-tech-design 提供已确认契约和未决问题；manager-run 不重新判断产品范围或替 Planner 追加计划。
判断依据是：前序结果是否可能实质改变后续的交付边界、验收标准、核心数据/API 契约或关键架构。只影响局部实现细节，不必推迟规划；高风险不等于需求不明确，规划完整性与人工验收仍分开判断。

## 参数与优先级

Skill 调用支持 `planning=auto|full|rolling`，默认 auto；这是 Skill 请求约定，不是 Codex/OpenSpec 的全局 CLI 参数。
本次用户明确参数或等价自然语言 > 项目 `manager/policy.yaml` 的 `planning` > 默认 auto。明确传 auto 就重新交给 AI 判断，不继承项目 full/rolling；一次调用覆盖不写回项目配置。参数与自然语言明显矛盾时指出具体冲突，不猜授权。

使用 execute Skill 随包脚本的只读命令解析优先级：

```bash
python3 "$PT" --plan manager/plan.yaml resolve-planning
python3 "$PT" --plan manager/plan.yaml resolve-planning --planning full
```

命令无需已有 plan、runtime 或执行检查配置，不生成文件、不批准内容；只返回 requested/source，不声称 Python 能判断需求是否明确。未知参数值或错误的项目配置报错，不静默退回 auto。mixed 是 AI 判断结果，不是公开参数值。

## 三种请求

| 请求 | 规划行为 |
| --- | --- |
| auto | AI 根据源证据决定 full、rolling 或 mixed；无须先问用户选模式 |
| full | 一次列出本次授权范围内的 Requirements、Changes、Batches 和显式依赖；不受一个 batch 限制 |
| rolling | 保留整体路线图，只细化最近一个可验收里程碑；其结果用于后续规划 |

auto 下：各后续边界稳定则 full；后续主要依赖本次探索结果则 rolling；一部分稳定、一部分依赖探索则 mixed。mixed 把全部已明确、依赖闭合的工作排入计划，未确定部分保留来源、问题及重新规划条件，不因为一处未知把全项目都退回单批。
用户选择 full 时不暗改为 rolling；未知内容仍须显式披露。能定义真实验收但缺关键前提的条目可列入计划并标为 blocked、写明 blockers；无法定义行为的内容留在 roadmap 并报告尚未细化，不编造需求、批准或虚假 acceptance。
完整计划只确定交付边界，不提前生成全部 proposal/design/specs/tasks。制品在对应 Change 执行时细化；未来必需输入只登记真实来源和生产依赖，不能要求尚未生产的文件在规划阶段提前存在。

## 留下最小判断记录

在既有 `manager/runtime/planning/<id>.md` 的覆盖报告中记录，不给 plan 增加第二套规划状态机：

```yaml
planning_strategy:
  requested: auto
  source: auto  # user | project | auto
  resolved: mixed  # full | rolling | mixed
  scope: docs/prd/example.md 中本次明确授权的范围
  planned_batches: [m1, m2, m3]
  deferred:
    - source: docs/prd/example.md#external-data
      reason: 外部数据契约待真实样本验证
      resume_when: 样本验证完成并确认数据契约
```

正文附 1–3 条具体来源证据即可。这里是判断/覆盖记录，不是审批凭证；resolved 不能擅自改变 requested=full/rolling 的请求。

## 批次停点独立判断

`batches[].checkpoint`：manual（缺省）或 auto。manual 到产品验收停下；auto 表示在本次执行授权覆盖该批次且真实 gate 全部有效时，可继续下一已授权批次。AI 在预览中建议，用户对包含停点规则的范围批准后才生效；planning=full 本身不是执行或跨批批准。
已确定且没有未决产品/技术判断的普通批次可以建议 auto。新 UI 方向、探索结论、需人工裁决的契约/架构变更，以及 risk: high 所在批次必须 manual；脚本拒绝高风险批次设为 auto。最终需要用户验收的里程碑也保留 manual。auto 不免除任何 change/apply 检查、独立审查或适用 UI 证据，不写入人类产品验收记录。

对完整规划中已明确的部分，无需每完成一批再次调用 Planner。到滚动/混合规划的未排期边界，在最后一个已规划批次写 `planning_boundary: <来源与待决原因>`；Runner 返回 STOP(planning-boundary)，不自动生成或批准下一批。它只阻止越过该边界，不证明之前产品验收已通过。
manual 优先停在产品验收；验收后明确选择下一段或重新规划。追加新批次前，在预览中列明已解决的旧 planning_boundary；用户确认后才移除该已解决标记，不修改原批次完成证据。边界/批次变化要求新的运行授权，不能沿用旧 session 偷换范围。

不要把执行范围之外的“以后也许做”强行变成当前停点。session 范围耗尽的 no-work 只代表本次授权范围结束，不等于全产品完成。
