# Manager / OpenSpec 设计接入

生命周期、就绪和反馈只引用 [设计工作流](../../DESIGN-WORKFLOW.md#执行范围)；调度/状态只引用 [Manager](../../MANAGER-WORKFLOW.md)。本页仅定义阶段之间的输入与回写，不另建流程或状态机。

## 设计到技术与规划

设计阶段以已确认 PRD/需求范围为入口，不需要 Change/task IDs。任务与交接正文维护在同一份需求级设计记录；可编辑 Pen、来源修订、真实 Frame、必要状态/主题/视口及接受和检查范围可定位，不把占位路径当就绪证据。

`manager-tech-design` 实际读取该记录与相关设计节点/状态，再完成实现契约；冲突沿共同反馈链修同一设计来源。Planner 只消费就绪且与技术一致的当前范围；不以把制稿排成未来任务的方式越过前提，不新增 UI/UX 里程碑或平行需求清单。

PRD 由 requirements.source 引用，技术方案由 technical_design 引用。共享设计使用现有 inputs（source、purpose、required、scope）与实际消费者 input_refs；已确认实现目标用 required=true，purpose 可为 reference，它不获得改写产品规则的权威。仅风格参考保持可选；无 UI 的 Change 不挂无关设计。

## 当前 Change 内执行

1. Execute 读取已确认需求、正式方案与绑定的设计依据；已有稿直接消费，不在 Execute 重新生成当前需求整套设计。缺必需来源、接受或实质交互状态时返回共同反馈链，阻塞受影响实现并继续真正独立的已授权工作。
2. 到当前就绪 Change 才按实际 OpenSpec schema/instructions 生成或更新制品。`design.md` 保留技术方案其他章节，**UI 实现依据**只维护上游设计记录的链接/修订、所选 Frame/状态及批准适配，不复制上游 UI 设计任务正文。
3. Apply 的 UI 任务委托 **`design-to-code`**：交接 **Change + task IDs + 页面/区域/状态 + 设计来源 + 读写范围 + 检查授权**，只实现所选未完成任务。后端按普通实现；制稿已覆盖当前需求不授权生成整份 Plan 的代码。
4. 实现者返回真实 diff、task IDs、检查与缺口，由原协调者回写原 `tasks.md`、Plan 和 progress。设计协作者不写代码或完成状态；`design-to-code` 不建任务清单、不勾其他任务、不递归启动 Apply/Run。
5. 设计或关键契约变化时，核对实际消费者和来源版本；先按同一反馈链处理，已有计划交 manager-revise-plan 只更新受影响制品/依赖及待复验项。代码错误由原实现者修，不改正确设计迁就代码。

同一阶段内真正独立任务可并行；同一文件/共享契约冲突时串行。阶段代码权限仍由 Run/Execute 决定；设计范围不是代码写入范围，不提前创建后续 Change 或代码。

## 引用与原生 Apply

inputs/input_refs 是 Manager 字段，原生 OpenSpec 不会自动展开。Execute 必须把选中来源的实际链接、Frame/状态、修订及任务边界写入当前 `design.md`，在 `tasks.md` 的 UI 条目明确 `design-to-code` 范围。Apply/恢复读取真实 contextFiles，沿链接定向读取设计与源码，不只检查路径存在。

原生 OpenSpec 不会自动调用 Skill。执行 Agent 必须实际加载 `design-to-code`；直接 Apply 也消费同一 design/tasks 约束，不修改第三方 Skill。schema 没有 design/context 时使用实际等价制品，不能跳过必需设计。

具体原生入口遵守已安装版本的授权/返回边界；若 propose 仅生成制品且要求返回，就保留当前就绪制品，按实际规则再进入 apply，不宣称一个 CLI 自动串联所有 Skill，也不修改第三方入口绕过停点。

行为由 PRD/specs 定义；例如用户选择 30 分钟，内部转为 1800000 毫秒，而不是让用户填写内部字段。Pen 表达视觉/交互状态，不能代替 API、权限、错误和恢复契约。

## 验证与恢复

代码检查按原 Execute 授权，不附加逐 Change 浏览器门禁；`design-qa` 在已授权的还原/运行验收位置取证。设计接受、code-verified、最终产品 human_acceptance 分开记录，原生 all_done 不代表产品已验收。

同一来源未变化可复用有效证据；新任务/修订核对 [缓存合同](../../design-to-code/references/cache-contract.md)。前置设计被修改时检查技术/计划及实际消费者，只失效受影响结果；不更换任务 ID 清零失败，不用缺工具或静态夹具冒充真实设计完成。

归档按 [归档入口](../../manager-archive-completed/SKILL.md)修复本次移动产生的相对链接，需求级设计记录与 Pen 保持原位置，不修改旧历史；所有引用保留原目标和锚点。
