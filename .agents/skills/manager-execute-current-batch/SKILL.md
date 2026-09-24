---
name: manager-execute-current-batch
description: Execute one approved Manager selection with native role dispatch, task-level parallelism, fresh evidence gates and bounded repair; never auto-archive.
version: 2.0.0-rc.3
---

# Manager 执行当前批次

## 入口与控制面

先定位本 skill 的 `scripts/plan_tool.py`，以下用 `$PT` 表示该完整脚本路径。运行环境为 Python 3.11+、PyYAML。
读取 `manager/plan.yaml`、`manager/policy.yaml`、`manager/roles.yaml` 和本次 change 所需的明确输入。
运行 `python3 "$PT" doctor`；它只检查静态配置，真实 Codex/model/permissions/浏览器另做预检。

必读：[handoff](references/subagent-batch-handoff.md)、[输入契约](../manager-plan-from-doc/references/input-contract.md)、[证据](references/evidence-contract.md)、[自动修复](references/verify-auto-repair.md)。

## 输入解析

派发前使用 `resolve-inputs --change <id>`；next 返回的 entry.inputs 也已按同一逻辑展开当前消费者的 input_refs 和局部 inputs。
公共定义不自动继承，不允许同名覆盖；缺引用或结构冲突停止，不回退为空。保留 required/scope/snapshot，真实工具核验来源和 locator；本命令不代替可读性验证。
PRD、技术方案和 UI 基线仍从各自专用字段读取；项目规范由 AGENTS/角色路由按需提供，源码入口按 reads 调查。
不得为了少改执行器而把公共 inputs 重新复制回各 Change；Review、Verify 和内容摘要同样消费有效输入。并行交接只写 status/notes 副本，不修改公共定义。
安装升级需包含同目录 plan_inputs.py，不能只替换 SKILL.md 或只拷贝 plan_tool.py。

## 选择与批准

本 skill 每次只执行一个 selection。被 `manager-run` 调用时必须使用 round-begin 返回的 selection，不重新选择、不内部循环跨 batch。独立调用可用 `next --scope auto --batch <id>` 选择指定批次的当前 wave，先 change 再 apply。
`next --scope full` 是候选选择范围，不是 Planner 的 `planning=full`，也不是执行授权；`legacy-all-change` 仅兼容全量制品优先顺序，不能作为默认 Goal。所有规划策略都只按实际 selection 生成必要制品。
跨 batch 连续推进由 run 的 session 与 checkpoint 负责；独立执行也须核对前序批次的人工验收/规划边界，不得用 next 绕过停点。选择结果仅说明候选 change，实际写入仍需授权与 task-level 冲突检查。

先报告目标、阶段、技术批准状态、有效输入可用性、写入范围、验证命令和并行方案，再依据真实授权启动。
技术方案未批准或已变化时停止。普通变化可以复用对应批准范围的授权；高风险或实质偏离原方案必须重新人工审查。
禁止默认 review=off 自动把新制品当作用户批准。审批可引用已明确批准的本次计划/范围，不可引用 Agent 自己的建议。

## change 阶段

1. `start --change <id>`，工具检查依赖、必需来源和技术批准。
2. 识别本机实际 OpenSpec 版本及可用 commands/skills。优先使用实际安装的 propose/explore/update/apply；ff/verify 是可选扩展，不能假设一定安装。
3. architect 按 handoff 返回设计和制品草稿；Manager 单写目标活动目录。一个 change 只有一个制品写入方。
4. proposal/spec/design/tasks 保留原意并引用技术方案，只写当前差异。可并行进行只读调查，不同时生成两份互相覆盖的四件套。
5. 必需输入逐项解析。scope 使用源内稳定 locator；不支持或歧义时停止，不能扩读另一个文件冒充对应输入。远程输入明确解析为本地 snapshot 后记录，不隐式抓取替代资源。
6. `gate-run --change <id> --stage change` 执行真实配置校验；通过后 `advance --completed change`。工具写 review pending。
7. 核对制品符合批准的技术方案和范围，再通过 `set-review --review approved --decision-ref <真实授权/评审引用>` 放行。未得到覆盖本次范围的批准就停止。

## apply 阶段

1. `start --change <id>`；记录实现起点。既有旧计划的 approved 字符串不能替代当前内容的批准凭据。
2. 普通小型串行 change 可直接给一个 Worker 有边界的任务；大 change 使用 `execution.yaml`。
3. `task-ready --change <id>` 给出可并行任务与被阻塞原因。不要再用 selection.parallel 限制同一 change 的内部 DAG。
4. 通过真实 Codex 原生工具创建对应角色的等待分配线程；取得真实 agent ID。先执行 `task-claim`，再发完整任务让它开始写入。无法等待/分两步派发时先串行执行，不能先改代码再补 claim。
5. 任务只拥有明确路径和资源；Worker 不勾 tasks.md、不写计划、不运行整个 change 的重复 apply。它返回结果，Manager 使用 `task-finish` 核对并勾选。
6. 并行写入前要确认文件、共享契约、DB、端口、缓存、浏览器会话都隔离。需要 worktree 时先获得 git 操作授权。当前调度器的路径边界是精确文件/目录，不支持猜测 glob。
7. 所有 Worker 结束后，在同一集成快照做 QA 与必要 UI/安全审查。读密集审查可并行，但共享测试资源也要隔离。
8. `snapshot --change <id>` 的输出原样交给独立 Reviewer；返回 evidence-contract 指定报告。不要把实现者的长解释当作验收证据。
9. `gate-run --stage apply --review-file <报告>` 执行完整配置门禁。实际 UI 修改或 impacts 包含 ui 时必须有基线批准、浏览器操作与截图证据。
10. 通过后 `advance --completed apply`，否则按有限自动修复规则处理。Gate 存在/过期/被改写时工具拒绝推进。

## 并行边界

默认最多 4 个原生子线程、2 个写任务；这些是起始配置，不是普适最优值。记录实际延迟后再调。
正在运行的 claim 必须确认原 Agent 已停止后才能释放；租约过期或重启不自动允许第二个 Writer。
未知角色/没有原生工具时停止，或得到明确许可后使用串行降级并报告。不要将模拟角色对话称为 Multi-Agent。
同一项目最终 gate 默认串行集成验证。大型项目可由人工审查 code_roots 划定完整影响范围，不允许 Agent 为加速随意缩窄。

## 返回

返回实际 change/task/agent ID、修改文件、验证凭据位置、阻塞/剩余风险、耗时与下一步。
简短摘要不丢失证据引用。每批结束汇报技术检查结果和待人工验收事项；`checkpoint: auto` 不等于用户产品验收。
批次首次交接与归档前需要最新集成 gate；同批后续代码使早期 gate 过期时，只重验相应 archive-ready 条目，不重新实现。已交接批次供后续消费时校验契约及证据，不用旧全库代码快照无限阻塞开发。
Gate 或修复失败不自动修改规格，不归档，不发版。

## 共同边界

遵守 [Manager 总体工作流](../MANAGER-WORKFLOW.md) 和项目 AGENTS.md。这里只修改被明确授权的文件。
不修改第三方 CLI 生成的 OpenSpec Skills，不私自 git add/commit/push、部署、发布或归档。
归档目录永远不是普通修复的写入目标。状态只通过 plan_tool.py 修改。
真实工具、模型、浏览器或验证不可用时明确报告，不模拟已经执行。
