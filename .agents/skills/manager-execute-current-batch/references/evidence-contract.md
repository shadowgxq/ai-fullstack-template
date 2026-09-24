# 可验证交付与任务结果

## 完成协议

`gate-run` 实际执行 argv（shell=False）、记录退出码/超时/日志 hash，绑定当前代码、需求/方案/输入内容、配置与活动制品摘要。`advance` 只接受匹配当前内容的成功凭证。
结构 validate 不需要业务来源已生成；开始实际消费者任务前，required 来源必须存在并能定位 scope。共享 input_refs 由唯一 resolver 展开，不重复存回 plan。
支持 heading、显式 id/anchor、json-pointer、operation-id、目录 path locator。其他 locator 或遗留裸关键词必须明确迁移成可解析的来源/快照；不能猜区域或全量降级。文件 hash 仍采用整个显式来源，保守失效。

新增 capability 的 delta spec 应包含明确的 `## Purpose`，由真实 OpenSpec 归档继承到主规格；不能留下自动生成的 TBD 目的说明再跳过主规格 strict 检查。

## 独立 Review

先运行 `snapshot --change <id>`，把 JSON 原样交给非实现线程。Reviewer 返回以下 JSON/YAML；Manager 在独立、不可复用覆盖的运行路径保存：

```yaml
snapshot:
  change: <id>
  revision: 1
  contract: <snapshot 返回值>
  code: <snapshot 返回值>
reviewer_agent_id: <真实独立线程ID>
findings: []
evidence:
  - manager/runtime/evidence/<run>/behavior-check.txt
# 发生 UI 影响时必需：
ui:
  decision_ref: <真实产品或视觉验收引用>
  screenshots: [manager/runtime/evidence/<run>/page.png]
  interaction_evidence: manager/runtime/evidence/<run>/browser-check.txt
```

```bash
python3 "$PT" snapshot --change <id>
python3 "$PT" gate-run --change <id> --stage apply --review-file manager/runtime/evidence/<run>/review.yaml
python3 "$PT" advance --change <id> --completed apply
```

findings 每项须含 severity（critical/blocker/warning/suggestion）与 description；阻塞项拒绝通过。UI 判断兼顾 impacts 和实际源码变化，要求已批准 ui_baseline。
截图存在性检查不能证明视觉正确；真实浏览器记录和人工方向验收仍由实际工具与人完成。禁止把空证据、模拟截图或模型自述冒充真实验收。
归档就绪后若其他 Change 改变集成代码，允许重新 gate-run --stage apply 更新集成验收凭证；不能直接利用旧 gate 归档。

## 可选任务 DAG

活动目录 `execution.yaml` 使用 `tasks` 列表。每项 id/role/needs/reads/writes/resources/acceptance；都是静态定义，运行状态只在 runtime。
needs 是同 change 任务 ID；reads/writes 为精确相对文件或目录，无隐式 glob；不确定读范围用 `.`。先契约后实现，真实资源隔离后才并行。

```bash
python3 "$PT" task-ready --change <id>
python3 "$PT" task-claim --change <id> --task <task-id> --agent-id <真实线程ID>
python3 "$PT" task-finish --run-id <claim返回ID> --result manager/runtime/evidence/<run>/task.json
```

结果含 run_id、agent_id、claim 的 contract、status（completed/failed）、changed_files，以及 checks:[{status: passed,evidence: <实际证据路径>}]
Worker 不修改 tasks.md 勾选、plan、Spec 或归档；Manager 校验结果后只勾对应唯一任务项。任务测试报告不替代最终集成 gate。
claim 是持久占用，不是租约：只有确认原线程停止才可 task-release --agent-stopped --decision-ref。相同线程同时领取多任务不允许。
共享工作区只可核对同时在制任务的总体写边界，不能可靠归因；更严格的隔离使用独立 worktree/沙箱和受信集成器。

## 恢复和证据真实性

记录以完整性摘要和事务 journal 保护，崩溃后 recover 可重放未完成写入，冲突不覆盖。日志、审批引用和证据不能跨任务/版本伪复用。
requested 模型配置不等于 observed 模型。本 runtime 不调用模型服务，native_execution 保持 unverified；实际派发与模型日志核验由 Codex 适配步骤完成。
