# 单任务 Handoff 协议

```yaml
session: <有界Goal ID，独立执行可省略>
batch: <batch>
wave: <wave>
change: <change>
stage: apply
task_ids: [api]
agent_type: backend-dev
agent_id: <真实原生线程ID>
run_id: <task-claim返回ID>
contract: <当前contract摘要>
inputs: [] # 当前消费者有效输入的独立副本，保留id/kind/source/required/scope/snapshot/status/notes
reads: [packages/contracts, ai-service/reporting]
writes: [ai-service/reporting]
resources: [export-test-db]
acceptance: [此任务独立可验证结果]
checks: [真实可执行命令]
forbidden: [manager, openspec, docs/prd, docs/technical, docs/design/baselines]
archive_allowed: false
```

按 [输入契约](../../manager-plan-from-doc/references/input-contract.md) 交接：先运行 resolve-inputs --change <id> 展开 input_refs 和局部 inputs，再解析真实来源。
不把顶层 registry 全量广播给每个 Agent；不把 input_refs 当作文件路径；不能只读局部 inputs 而漏掉公共定义。
主 PRD、技术方案和 UI 基线从专用字段交接，项目规范通过 AGENTS/角色路由补读；不要重复塞回 supporting inputs。
来源可读性、scope 和 snapshot 必须逐项核验；missing required stop。不得浏览未声明参考资料来冒充批准输入。
同一 Change 内按任务用途提供必要上下文，治理、契约和共享约束不能因角色分工而丢失。运行可用性 status/notes 只写副本，不回写公共定义。
Review、Verify、摘要计算也使用相同有效输入集合，避免实现和验收读取不同契约。
初次派发先让原生线程等待，保存 claim 后才授予本任务写入许可。claim 是协作锁，不是文件系统ACL。
Worker不写计划和勾选。返回：run_id/agent_id/contract/status/changed_files/checks[{status,evidence}]和风险。
结果由Manager写到runtime/evidence，使用task-finish核对。checks里的自述不能替代最终gate真实命令。

建议记录 requested_model 与 runtime实际可见 observed_model；不可见就null，不能把角色默认值伪称实际运行值。
多个任务共享工作区只能验证整体边界，无法可靠鉴定谁实际改了别人的文件；需严格追责时使用隔离worktree和受信runner。
