# Manager Plan v2：兼容减重格式

保留 requirements、openspec、batches 和原 phase/state 生命周期，不增加另一份规划状态机。
运行日志、任务 claims、审批、gate、session 检查点以及规划判断记录外置到 manager/runtime。

```yaml
version: 2
requirements:
  - id: req-example
    source: docs/prd/example.md
    acceptance: [一个可验证的外部行为。]
inputs:
  - id: shared-api
    kind: api-contract
    source: docs/api/contracts.md
    required: true
openspec:
  - id: add-example
    title: 新增示例行为
    phase: change
    state: planned
    requirements: [req-example]
    technical_design: [docs/technical/example/overview.md]
    input_refs: [shared-api]
    # risk: small | standard（默认）| high
    # revision: 1（默认，修订工具维护）
    # impacts: [ui, api]
    # ui_baseline: docs/design/example.md
    # depends_on: [稳定依赖ID]
batches:
  - id: example-m1
    goal: 完成一个可验收闭环
    checkpoint: manual # 可省略；auto 必须有覆盖停点策略的执行授权
    # planning_boundary: docs/prd/example.md 中下一阶段契约待真实数据验证
    waves:
      - id: main
        openspec: [add-example]
current:
  batch: example-m1
  wave: main
```

## 原格式兼容

version 缺省按 v1 读取；updated_at/current 长说明/path/artifacts/tasks 等旧字段仍可读。
只有 canonical path 和 tasks 才可以按默认推导；不支持把活动路径指向 archive 或任意目录。
compact 预览，compact --write 备份后减少重复字段；未知元数据、验收、语义依赖及停点字段保留。
迁移不把 review:approved 变成可信证据；进行中的旧任务要核验后补建对应批准和 gate。

## 规划与批次停点

规划请求 auto/full/rolling 及优先级见[规划策略](planning-strategy.md)；requested/source/resolved 保存在既有覆盖报告，不复制进每个 Change。
batches 可以包含多个已规划里程碑，不限制一次只能生成一个。完整计划不要求提前生成四件套。
checkpoint 仅接受 manual/auto；缺省 manual 保留旧停点。auto 只允许有效技术检查后向授权范围内下一批继续，不产生人类产品验收。risk: high 所在批次必须 manual。
planning_boundary 为可选非空字符串，记录未排期范围的来源与再规划原因；到达后停止，不自动扩展 session。
这些字段属于审批预览和 session 冻结范围，活动期间改动必须重新授权。只移除已解决且获批准的边界，不能编辑 runtime 凭据绕过。

## phase 与 state

phase：change → apply → archive → done；state：planned / ready / in-progress / blocked / cancelled。
review pending/approved 保留，但 approved 必须有匹配 contract 的记录。
Cancelled 不是完成，不能满足 depends_on。Done 通过可验证 completion record 解析历史依赖。
新工作通常 change/planned；已明确但缺必要条件可为 change/blocked 并记录 blockers，恢复走受控 reopen。
behavior 不控制调度。next 的 scope 控制执行候选，不是 planning 参数；legacy-all-change 是显式全量制品优先兼容模式。

## 输入

权威规则见[输入边界与共享引用](input-contract.md)。项目规范与源码调查不进 Input；PRD/技术/UI 来源不重复登记。

| 字段 | 语义 |
| --- | --- |
| 顶层 inputs | 公共定义，不自动继承；每个 ID 只定义一次 |
| openspec[].input_refs | 当前 Change 消费的公共 Input ID |
| openspec[].inputs | 独有完整定义；兼容旧 inline 格式 |

定义字段为 id/kind/source/required，可带 scope/snapshot 和已有元数据。相同定义多处消费必须提升；无 supporting input 时可省略。
不能引用另一 Change 的局部 Input 或同名覆盖；不拆成额外 registry。不同 scope/required/snapshot 不合并，多个 locator 放在同一 scope。
远程来源用实际工具取得的本地 snapshot；requirement 的远程 source 也支持 snapshot。
支持 heading、id/anchor、json-pointer、operation-id、目录 path；歧义/不支持的 locator 明确处理，不猜测。摘要绑定整份来源，来源变化要重新核对批准。
普通 validate 对旧重复/规范 Input 给警告；新计划必须 validate --strict-inputs。结构验证不要求未来待生产来源提前存在，实际 start 才检查 required 来源和依赖。
resolve-inputs 只展开当前消费者，返回独立副本。normalize-inputs --output <新文件> 写候选，不删规范、不覆盖活动计划或重置证据。
归档快照携带当时完整 Input；删除公共定义前确认没有剩余引用。

## execution.yaml 与执行方式

复杂 Change 的任务图放活动目录，仅定义 id/role/needs/reads/writes/resources/acceptance，不放运行状态。串行小 Change 不强制增加文件。

## 减重边界

默认路径、默认 artifact 列表、空 inputs/deps、current 长说明可省略；独立验收信息和真实依赖不能为缩短 YAML 而删除。
