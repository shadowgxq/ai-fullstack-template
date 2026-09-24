# OpenSpec Manager v2

控制工具版本：2.0.0-rc.3。安装与旧项目接入见[迁移说明](MANAGER-V2-MIGRATION.md)。

## 定位与主流程

PRD 定义行为；技术方案定义实现边界、核心流程、伪代码与关键决策；OpenSpec 记录本次差异；Manager 管理依赖、授权、任务、修复和证据；Goal 只反复推进明确授权的有限范围。
保留 Manager + OpenSpec + Codex，不引入另一套 Agent 框架。“代码/文档自洽”不等于用户已验收产品。

```text
产品需求 → 总/专项技术方案 → 人工审阅
  → 规划策略与 Change 拆分 → 计划/停点预览与批准
  → 明确执行范围 → manager-run 逐 selection 调用 execute
  → 当前 Change 制品与批准 → 实现 → 真实检查与独立验收
  → 自动检查点继续 / 人工产品验收 / 规划边界停止
  → 按需修复或受控修订 → 显式归档
```

探索先验证方向，局部小修走 repairs，不强制完整新设计。新 UI 先确认代表性页面，再批量扩展。

## 八个 Manager 入口

| Skill | 职责 |
| --- | --- |
| [manager-prd-review](manager-prd-review/SKILL.md) | 按风险评审需求与产品裁决 |
| [manager-tech-design](manager-tech-design/SKILL.md) | 技术总/专项方案、核心流程与人工批准 |
| [manager-plan-from-doc](manager-plan-from-doc/SKILL.md) | AI 判断规划深度，接受用户覆盖，形成 Change、依赖与批次停点 |
| [manager-execute-current-batch](manager-execute-current-batch/SKILL.md) | 执行一个 selection，负责实际任务与验证 |
| [manager-run](manager-run/SKILL.md) | 在明确授权的一个或多个批次内持续驱动，恢复与停止 |
| [manager-bugfix](manager-bugfix/SKILL.md) | 按复现最小修复，不迁就错误代码改 Spec |
| [manager-revise-plan](manager-revise-plan/SKILL.md) | 受控修订、影响分析与批准/证据失效 |
| [manager-archive-completed](manager-archive-completed/SKILL.md) | 真实归档、历史保护与剪枝 |

repair-intake/repair-runner 为独立项目小修队列，不共享 Manager 状态机。

## 规划范围、细化深度、执行授权分开

本次用户参数/明确自然语言 > 项目 policy.planning > 默认 auto。公开请求为 planning=auto/full/rolling；auto 由 AI 依据 PRD、技术方案与实际不确定性判断 full/rolling/mixed。
明确的交付边界可以一次规划多个里程碑，后续依赖探索结果的部分留 roadmap；只在执行对应 Change 时生成其详细制品。full 不意味着预生成全部四件套，也不意味着允许执行全部批次。
判断记录复用 manager/runtime/planning/<id>.md，不增加另一份状态机。唯一详细规则见[规划策略](manager-plan-from-doc/references/planning-strategy.md)。

用户批准本次运行范围，例如 M1～M3；manager-run 可以连续推进其中 checkpoint: auto 的普通批次。每批仍有真实检查、独立审查和技术检查点，不自动写人类产品验收。
checkpoint: manual（缺省）保留产品验收停点；高风险与未决产品/技术判断必须 manual。planning_boundary 表示未排期决策边界，不自动调用 Planner 扩范围。
已有后续计划且条件未变时直接执行，无需每批重新 plan；条件改变才做受控修订。所有自动化保持在真实授权范围内。

## 拆分与 Input

Change 是显式依赖完成后可独立验收的一次行为变化，不是代码层、目录或一位 Agent。前后端/测试通常为内部任务；Requirement/Capability/Change/Task 不要求一一对应。
读取 PRD 全文行为，保留权限、失败恢复与持久性，按验收归属分组；执行五项边界测试和合并复核。20–25 个任务只提示粒度审查。
规范经 AGENTS/角色入口读取，源码由定向调查；PRD/技术/UI 基线走专用字段。真正契约、数据和快照在顶层 inputs 定义一次，实际消费者用 input_refs；无隐式继承。
保留 scope/required/snapshot 的不同语义，不为降低输入数量删除约束。见[输入契约](manager-plan-from-doc/references/input-contract.md)。

## 控制文件与批准

plan.yaml 保留 requirements/openspec/batches，phase 为 change→apply→archive→done；非 done 的 state 为 planned/ready/in-progress/blocked/cancelled。
manager/runtime 保存批准、claims、gate、预算、session/checkpoints 与事务。计划正文不放日志。生命周期状态由 plan_tool.py 写。
manager/roles.yaml 映射角色；.codex/agents/<name>.toml 定义真实角色；policy.yaml 配置检查、资源上限与可选规划默认值。
命令以 --capabilities / --help 为准。resolve-planning 只读解析请求优先级，不推断需求、不生成计划或批准。
validate 检查结构；start 另核对真实 required 来源、依赖、技术批准。旧 approved 字符串、planning=full、session 创建或重启都不能替代内容批准。

## 执行、并行和证据

每轮只处理返回的 selection；先当前 wave 的制品，再实现，不先生成整个项目制品。full/legacy-all-change 执行 scope 不是规划模式，也不是额外授权。
外层 Change 并行与内部 execution.yaml Task DAG 分开。任务依据 needs/reads/writes/resources 及并发上限选择；文件、契约、DB、端口和浏览器会话参与冲突检查。
先创建真实等待任务的线程，取得 ID 并 task-claim，再给写授权。Worker 不改 plan、不勾 tasks；Manager 核实后单写。原线程未停不得抢占，协作锁不是 ACL，严格隔离用 worktree/沙箱。
gate-run 执行 OpenSpec strict validate 与项目检查，要求独立 Reviewer 和适用 UI 证据；advance 核对 code/contract 与证据，日志或报告被改写则拒绝。
首次跨批检查当前集成快照；后续消费已记录的契约与证据，不因正常下游代码变化无限重验上游。当前 Change 与归档前仍需 fresh gate。证据格式见[协议](manager-execute-current-batch/references/evidence-contract.md)。

## 修复、修订与恢复

要求对、代码错：聚焦允许路径，自动最多 2 次，预算跨重启保留。无进展、越界或 contract 改变则停止，不能迁就代码改规格。
需求/设计变化先拿真实裁决、停止受影响线程，计算显式依赖闭包并核对共享要求/输入的消费者；只改受影响内容，旧批准与证据失效。Cancelled 不能当作完成依赖。
session-open 固定批次及停点范围和轮数；每轮 round-begin/execute/round-finish。未收尾轮次先核对结果，不重复派发。
正常进程中断可恢复 active session；STOP 后需明确新授权，不能自行重开。范围耗尽、人工裁决、规划边界、失败或预算均停，不把 no-work 当全产品完成。
上下文保留目标、版本、决策和证据索引；Worker 仅获取任务必需资料，新轮次/压缩不保证假设隔离。

## 历史与发布

归档、PR 合并与生产发布为独立操作。归档需显式授权：archive-prepare → operator 执行真实 openspec archive → archive-finalize，不自行实现规格合并。
旧历史先审计再 seal；scripts/archive_guard.py 用可信 Git 基线检查旧归档增删改。completion-import 不伪造旧 gate；正常证明存在后才 prune，Input 快照保留历史消费语义。
legacy/ 只保存历史流程，不自动安装/切换，不与当前 runtime 混用。
安装、结构/控制测试、真实 OpenSpec CLI、原生 Agent 与业务/UI 验收分别报告，不以其中一层通过代替全部生产验收。
