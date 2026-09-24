# Manager v2 安装、迁移与验收

控制工具版本：2.0.0-rc.3。Python 3.11+、PyYAML；实际项目需要已安装的 OpenSpec CLI 和可用的原生 Agent 工具。
不能仅更新 SKILL.md。`manager-execute-current-batch/scripts/` 中 8 个 Python 文件必须作为同一版本安装。

## 1. 先检查，不改变产品批准

备份当前 Skills、项目 plan、policy、roles 和 runtime。停止旧 Goal 与正在写入的 Agent。
定位实际控制脚本；以下 `$PT` 是其完整路径。运行：

```bash
python3 "$PT" --capabilities
python3 "$PT" --plan manager/plan.yaml validate
python3 "$PT" --plan manager/plan.yaml resolve-inputs --change <change-id>
python3 "$PT" --plan manager/plan.yaml doctor
```

capabilities 必须包含 resolve-planning、doctor、approve-technical、task-claim、gate-run、archive-finalize。doctor 验证真实 policy/roles/task graph，不代表模型调用或业务运行通过。
项目可将同版本 runtime 固定在 `scripts/manager/runtime/`，用文件摘要清单校验；项目 validator 和执行包装器必须指向它，不能再维护一套不同阶段枚举的正则校验器。

## 2. 项目配置

`manager/policy.yaml` 示例使用已有 Node 项目脚本，采用前确认这些命令在本项目实际存在：

```yaml
version: 2
max_agents: 4
max_writers: 2
timeout_seconds: 300
checks:
  change: []
  apply:
    - [pnpm, typecheck]
    - [pnpm, lint:ci]
    - [pnpm, test]
```

OpenSpec strict validate 是内置必跑项，不因 change checks 为空跳过。缺少项目检查会阻止 apply；不能放 `true` 或打印 PASS 代替业务检查。
roles.routes 里的角色必须同时在项目 `.codex/config.toml` 以 `[agents.<name>]` + `config_file` 注册，并指向 `.codex/agents/<name>.toml`；角色文件的 name/description/developer_instructions 仍为 Manager 校验输入。模型、reasoning、权限按实际本机 Codex 版本核对，不能用角色自述证明模型。

项目模板采用两档原生模型策略：root 与默认 subagent 使用 `gpt-6-sol` + `xhigh`；architect/backend-dev/frontend-dev/product-manager/reviewer 不写模型字段，继承该默认值；explorer/qa/test-worker/ui-ux-reviewer 显式覆盖为 `gpt-6-luna` + `max`。切换主力模型只改 `.codex/config.toml` 的 root/default 两个入口；轻量角色保留显式覆盖，并由仓库测试约束四个角色保持一致。不要再引入 Terra 中间档或自定义 model_profile 翻译层。
已有工程规范继续通过 AGENTS.md 和角色阅读入口生效。它们不是每个 Change 的必需 Input。接口契约、数据/原型等真正输入共用顶层定义并显式引用，详见输入契约。

## 3. 计划格式与批准

v1 的旧字段兼容读取；v2 可省略可推导 path/artifacts/tasks、updated_at 和 current 的长描述，但保留 requirement acceptance、真实 depends_on 与状态。

```bash
python3 "$PT" --plan manager/plan.yaml normalize-inputs --output manager/candidate-plan.yaml
python3 "$PT" --plan manager/candidate-plan.yaml validate --strict-inputs
python3 "$PT" --plan manager/plan.yaml compact
```

normalize 默认只读，--output 必须新文件；只提升完全相同、同 ID 的多消费者定义，不自动删除工程规范，不合并不同 scope/snapshot/required。分类删去误登记内容由人审查，不等于改变产品要求。
确认候选后再替换活动计划。compact --write 带备份，只做格式减重。原 approved 字符串不赋予执行权，原测试报告也不自动转换成 gate。
先人工审阅具体技术文档与 PRD，再用真实授权引用运行 approve-technical；禁止把本次安装授权当成产品/技术批准。

### 规划策略与连续执行接入

`resolve-planning [--planning auto|full|rolling]` 只读解析本次参数与可选 `manager/policy.yaml` 的 `planning`，不要求已有 plan；AI 按[规划策略](manager-plan-from-doc/references/planning-strategy.md)判断确定性。不要用新版 policy 模板覆盖项目原有 checks 或审批材料。
旧 batch 不增加字段也可运行：缺省 `checkpoint` 仍为 manual。新计划经预览批准后，可对无需人工决策的稳定批次写 `checkpoint: auto`；高风险批次保留 manual。有未细化工作时在计划边界写 `planning_boundary: <原因/来源>`，不为了解锁 run 删除未解决事项。
完整规划不是执行批准，也不提前生成所有 artifacts。跨批次运行须在 session-open 中列明全部已授权 batch；旧 session 不扩容、不重置失败预算。新字段改变已授权批次定义时，先结束原轮次，再经明确授权创建新 session。
自动 checkpoint 只保存会话技术交接记录，不生成产品验收凭据。人工停点仍由 approve-milestone 记录真实验收；scope、契约、证据失效或取消项仍会停止。停下后不隐式重开 session。

## 4. 执行与证据

```bash
python3 "$PT" --plan manager/plan.yaml approve-technical --document docs/technical/<area>/overview.md --source docs/prd/<feature>.md --decision-ref '<真实批准引用>'
python3 "$PT" --plan manager/plan.yaml start --change <id> --agent-id <真实实现线程ID>
python3 "$PT" --plan manager/plan.yaml gate-run --change <id> --stage change
python3 "$PT" --plan manager/plan.yaml advance --change <id> --completed change
python3 "$PT" --plan manager/plan.yaml set-review --change <id> --review approved --decision-ref '<真实制品批准引用>'
```

apply 后按 [证据协议](manager-execute-current-batch/references/evidence-contract.md) 运行 snapshot、独立审查、gate-run 和 advance。多个 change 的报告采用独立路径，不覆盖先前证据。
旧 in-progress 缺少有效运行记录时不自动接管：确认原 Agent 停止，再通过 reopen 修订/重新验收。不能编辑 JSON 补出 PASS。
从次级 Change 消费已完成依赖时核对依赖 contract 和历史证据；当前 Change 的 gate 仍验证最新集成代码。归档前本 change 的 gate 必须全量新鲜，必要时对 archive-ready 条目再次 gate-run --stage apply，不重新跑整个实现。

## 5. 历史迁移和归档

先人工审计现有 `openspec/changes/archive`，再 seal-archives --decision-ref 记录基线。seal 已存在时拒绝刷新掩盖改写。
既有 done 或已剪枝历史只有经审计才用 completion-import --change <id> --destination <已存在归档目录> --decision-ref 导入。命令运行当前主规格校验并明确记录 prior_gate: unavailable，不伪造历史代码验收；取消项/活动项不能导入为完成。
正常归档依次 archive-prepare → 人工授权 operator 执行返回的真实 openspec archive 命令 → archive-finalize。失败保留 ticket；只有恢复并核对归档前状态后才可 archive-abort。
prune 仅移除具有有效完成凭证的 done，保存展开后的 Input 历史快照，后续依赖不因剪枝丢失。旧归档保持只读。

## 6. 回滚与安全边界

升级前备份是回滚来源。运行期间发现 journal 时先 recover；出现内容冲突保留现场，不删锁、journal 或历史证据。
如需回滚控制工具，先停止写入，把代码、plan 与 runtime 作为同一备份恢复；不能让旧工具读取新状态后继续自动推进。
本地 hash、decision_ref、agent_id 属于协作控制，不是身份认证；同用户恶意进程仍可篡改状态。严格边界需要受保护 CI、隔离工作区、权限和可信审批系统。
不保证 native Agent 已执行、不自动启动服务、合并 PR、归档或部署。实际 CI 的 live OpenSpec 测试与原生 Codex/业务/UI 验收是不同层级。