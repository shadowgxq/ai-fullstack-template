# Manager / OpenSpec 接入：设计交接，不接管调度

## 适用性与授权

默认自动判断“需不需要设计帮助”，不是所有 Change 自动启动一个 UI/UX 流程。后端/SDK/迁移不触发；普通 UI 小改沿用已有规范、做轻量差异检查；新核心流程、复杂配置器或明显任务退化风险才准备本 Skill 的设计交接。判断理由可写已有 note，不新增 uiux_gate 字段或新的 Plan 状态。

已有有效参考先复用。用户已经明确提供 UI Prompt、最终 UI 图、Figma、HTML/原型或其他设计材料，并要求作为当前实现参考时，直接登记为 Manager `purpose=reference` 输入并按实际消费者设置 scope；**不为了包装成 handoff 而补跑 ui-ux-delivery、UX 原型或外部出图**。这些材料仍不能覆盖已确认 PRD/权限/关键契约；发生实质冲突时按原有需求/方案修订流程处理。

只有用户显式调用，或已授权的计划明确委托本 Skill 生成设计时，才启动设计和写产物；泛泛的 manager-run 不授权新增长设计流程、外部发图或无关页面。先分析可发现事实；真正改变产品方向的未知点才暂停。外部图未回只阻塞实际依赖它的界面工作，共享接口/状态受影响时也必须承认依赖，不能仅因“后端”就假定可并行。

## 单一实现所有者

Manager 场景使用 target=handoff：ANALYZE → UX → VISUAL → HANDOFF_READY。设计就绪不是 code-verified、human accepted 或项目 Done。Skill 不执行 React/OpenSpec，不写 manager/plan.yaml、progress 或任务勾选。Manager Execute 是唯一业务实现与阶段代码检查入口，Run 只调度；原生 OpenSpec Skills 不修改。

设计可在技术细化前提供交互依据，也可在已有项目的当前阶段补充；不强制整个产品先出全套图，更不重置已有计划。短可行性检查和真实工程约束先读，设计不能替代需求或擅改技术契约。

## 引用方式（沿用现有 Plan 格式）

```yaml
inputs:
  - id: funnel-ux
    source: docs/design/ui-ux/funnel/ui-ux-handoff.json
    purpose: reference
    required: true
    scope: [funnel-editor]
openspec:
  - id: ordered-funnel
    requirements: [funnel]
    depends_on: []
    status: planned
    input_refs: [funnel-ux]
```

这是可并入已有 Plan 的片段，不是完整计划。purpose=reference 表示设计参考，不是新需求；required=true 仅表示本任务确实依赖这份资料。不能给每个 Change 广播所有图；没有真实依赖时不机械 required。用户直接提供的 Prompt、Figma、HTML/原型、最终 UI 图等都可直接作为 reference 使用，不强制先包成 handoff，也不因此补造 UX 批准记录。

Planner 读取交接的 Current/Preserve/Delta/Target Flow 与目标范围，按端到端意图划分 Change，而非每张图一个 Change。在现有 note 或 design/tasks 简记相关 Surface 和允许调整点，避免再生成 UX 追踪台账。

## 不止记录引用：进入原生 OpenSpec 的最小交接

`inputs/input_refs` 属于 Manager，原生 OpenSpec 不会替 Manager 自动展开这些引用。Execute 在生成当前 Change 时读取所选 scope，将来源路径、Surface 和关键保留边界简记到现有 design.md；从 PRD/已确认任务提炼至少一个业务输入 → 可观察结果的 Scenario，放入实际 schema 对应的规格。不要另建追踪台账，也不要全文复制 PRD/原型。

例如“用户选择 30 分钟，查询内部使用 1800000 毫秒”，而不是“支持 windowMs 字段”。进入 Apply 后，读取原生 instructions 返回的 contextFiles，并按 design 中的路径定向读取相关原型和最终图；不能只看任务清单或只确认文件存在。图片是视觉参考，不增加需求；reference 允许合理布局差异，不等于可以丢掉原需求的用户任务。

在 verify-report.md 保留最小证据：对应任务、实际代码/测试位置、已验证行为、仍需真实操作的条目。源码/接口测试不能声称视觉通过，原生 `state=all_done` 也不能代写 Manager 的 human_acceptance。阶段验收走真实入口、正常任务、失败恢复与受影响既有功能，不只对照截图或是否能打开页面。

## 消费与防偏移

1. 技术设计用相关用户任务约束接口和视图适配，但不照抄原型 Mock 数据、API 或演示权限。
2. 生成/Review 当前 Change 时对照 PRD与相关参考，写清关键用户输入、输出、保留边界与必要异常；UX 不能新增业务范围，文案/组件不是机械一比一。
3. Apply 必须消费 input_refs 所指范围。允许局部组件替换、响应式重排、无语义变化的排版优化；不能为了通用 Schema 将业务选择退化为内部 ID、JSON、毫秒参数手填。技术用户确实需要的技术字段不一概隐藏。
4. 写入范围和共享契约影响沿用现有边界审查。不以本 Skill 的 Mock 验证代替真实查询、权限或数据检查。
5. code-verified 仍由 Execute 的代码/逻辑/阶段集成检查决定；视觉与真实任务体验在 Plan 的阶段或最终人工位置验收。独立浏览器协助只按该验收任务的明确授权执行，不塞到每个 Change，不改 Run/Execute 默认语义。
6. 实质产品变化走已有 revise-plan；实现偏差走 bugfix。没有实质变化不再次审批设计；参考缺失/陈旧先核对影响，只有真实阻塞才停止依赖工作。

可选只读检查：`python3 <skill>/scripts/delivery.py --check-handoff <file> --project-root <root>`。只验证来源、范围、图片绑定仍有效，不判断模型输出质量或真实用户是否已接受。设计文件改动后刷新交接，不换 hash 冒充旧检查；原型迭代影响的 UI 检查重做，不自动重批整个 PRD。

## 不变的 Manager 主线

PRD确认 → 技术方案 → Plan → Execute/Run → 代码检查 → 已安排的产品验收 → 按授权归档/PR。UI/UX 是条件设计输入，不是第九个 Manager Skill，不引入调度器、角色/模型配置、通用人工 Gate 或第二份任务清单。Execute 一次一个 M 后返回；Run 仍在已满足真实停点时继续。最终 UI 图、原型批准及 HANDOFF_READY 均不能填成 human_acceptance=accepted。

按消费范围检查可追加 `--surface <id>`（可重复）。局部图变化只使对应引用失效；PRD、原型、共享 Contract 等整体来源变化仍须核对所有消费者。省略范围时验证整份 handoff；脚本不据此自动停止 Manager。
