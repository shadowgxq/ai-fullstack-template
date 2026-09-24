---
name: manager-run
description: Drive one persisted Manager round within explicitly authorized batches; continue across verified automatic checkpoints, stop for real decisions and planning boundaries, and recover without duplicate dispatch.
version: 2.0.0
---

# Manager 有界 Goal 驱动

Goal 重复调用本 Skill；每次只执行一个 selection。支持一个或多个已规划批次，不替代 Planner，不把规划参数当作执行授权。
默认从真实用户授权确定范围；不以 Goal 重启作为审批、归档或权限升级。

## 建立运行会话

先核对 manager/plan.yaml 中的批次、依赖、checkpoint/planning_boundary，以及技术/制品批准。用户可以直接说“连续执行已批准的 M1～M3”，由 Manager 映射实际 ID，展示本次范围和停点；无须用户手写脚本。
已有 session 时读取其范围和 open_round，不重复创建。没有 session 时，只有拿到覆盖所列批次及停点策略的真实执行授权，才调用：

```bash
python3 "$PT" session-open --batch m1 m2 m3 --max-rounds 12   --decision-ref '<本次批次范围与停点策略的真实执行授权引用>'
```

范围仅含已存在的 batch；同一批次不能重复列入。后续未排期内容不能作为隐含授权。保留返回 ID，外层 Goal：

```text
每轮执行 $manager-run，session=<实际ID>。仅在最后一行为 MANAGER-RUN: CONTINUE 时继续。
任何 STOP 或工具错误均停止并汇报，不自行重开 session，不自行批准或扩大范围，不归档。
```

## 单轮

1. round-begin --session <id> 核对冻结的批次/Change/验收/Input 定义、轮数、未收尾轮次和先前检查点。只把返回 selection 交给 manager-execute-current-batch，不另选批次。
2. Execute 完成真实任务、审批核对、checks、独立 Review 和必要 UI 验证；其失败与有限自动修复规则不变。
3. round-finish --session <id> 根据计划、任务、批准和 gate 的变化判断进展。未结束的真实 Writer 先核对/停止，不能为了收尾伪造任务状态。
4. 输出批次/阶段、修改摘要、验证证据、剩余风险及下一步。最后一行照录工具实际 footer；命令非零退出时报告错误并停止，不制造 CONTINUE。

## 跨批次与停点

| 情况 | 行为 |
| --- | --- |
| checkpoint: auto，真实 gate 有效，下一批仍在 session 授权范围 | CONTINUE；每批保存技术检查点并汇报，不调用 Planner |
| checkpoint: manual 或字段缺省，尚无人类产品验收记录 | STOP(milestone)，等待真实产品验收 |
| 到达 planning_boundary | STOP(planning-boundary)，报告待决来源和再规划条件，不自动补下一批 |
| 制品未批准 / 来源或 gate 失效 | STOP(boundary) 或 STOP(held)，不靠新 Goal 自动批准 |
| blocked/cancelled、无进展、预算耗尽 | STOP(blocked/no-progress/budget)，不静默跳过或重置 |
| 本次授权批次全部结束 | STOP(no-work)，不宣称整个产品完成 |

checkpoint: auto 不是自动产品验收，绝不代写 approve-milestone。高风险、探索结论、新 UI 方向及其他人工裁决保留 manual；规则见[规划策略](../manager-plan-from-doc/references/planning-strategy.md)。
首次跨批核对该批次最新集成 gate；当前快照不匹配时先报告需要重新验收，不跳过。后续轮次核对已记录的契约与证据，不因后续正常代码变化无限重验旧批；当前 Change 和实际归档前仍需 fresh gate。

## 恢复与授权

进程中断但 session 仍 active：读取 session、任务、contract 和证据；open_round 未收尾时先核对原线程结果，再 round-finish，不重复派发。
STOP 后的 session 不自动复活。用户处理验收/批准/阻塞后，以新的明确运行授权建立下一次 session；普通重启不等于批准。计划批次、停点、Change 语义、验收或有效 Input 定义变化会使旧 scope_hash 不匹配，不能改 JSON 绕过。
到规划边界：新工作用 manager-plan-from-doc，已有需求/技术变化用 manager-revise-plan；保留已经完成的代码、ID 和证据，不因换批次重新规划全部项目。

每轮新调用不保证全新上下文。主线程保留目标、版本、决策、阻塞和证据索引；Worker 只读项目规则、当前任务、必要契约和验收。重大修订后从持久记录重建上下文，保留修复预算。
max_rounds 是轮数预算，不是 token/cost 计费上限。没有外层 Goal 时，单次调用只执行一轮，不声称会自行后台持续运行。

## 共同边界

遵守 [Manager 总体工作流](../MANAGER-WORKFLOW.md) 和项目 AGENTS.md。这里只修改被明确授权的文件。
不修改第三方 CLI 生成的 OpenSpec Skills，不私自 git add/commit/push、部署、发布或归档。
归档目录永远不是普通修复的写入目标。状态只通过 plan_tool.py 修改。
真实工具、模型、浏览器或验证不可用时明确报告，不模拟已经执行。

旧 rc 会话的 scope_hash 仅绑定批次，不能证明完整授权范围；升级后先核对并收尾旧轮次，再以新授权创建会话，不编辑 JSON 给旧会话补版本。未知 batch ID 会报错，不当作 no-work。

单独授权下游批次不会绕过显式依赖的上游批次验收或 planning_boundary；控制器只读核对相关上游检查点，不扩大写入授权。不相关批次不因此阻塞。
