---
name: manager-archive-completed
description: Archive only explicitly approved, freshly verified active changes through real OpenSpec; verify immutable history and new archive content, then prune with persistent dependency records.
version: 2.0.0-rc.1
---

# Manager 显式归档与计划剪枝

## 边界

归档、代码合并、上线发布是三件不同的事。归档不代表生产验证完成，也不要求全项目永远没有优化事项。
当前 change 范围应满足验收；不能为了归档删除已承诺能力或把严重缺陷改名“以后优化”。
默认 Manager/Worker 的 archive 与主规格路径只读。因此实际归档必须切到明确人工授权的 operator 环境；不能自动放宽父线程权限。

## 首次接入已有历史

先由人核对历史目录，再运行 `seal-archives --decision-ref <确认引用>` 建立基线。已有 seal 不能被刷新来掩盖变化。
本地摘要是完整性检查，不是对抗同用户恶意进程的安全边界；配置和受保护 CI 共同执行约束。

## Stage A：真实 OpenSpec 归档

1. 只选择 phase archive 且无阻塞项，展示 ID、路径、当前证据、未关闭但非阻塞事项。
2. 确认人工归档授权，`archive-prepare --change <id> --decision-ref <批准引用>`。
3. 工具要求 fresh apply gate、任务完成、没有活动 writer，生成持久 ticket，记录当前活动内容和原有归档摘要。
4. **人工授权 operator** 执行返回的真实命令 `openspec archive <id> --yes`。不调用 `--no-validate`，不自己移动目录或手写 spec merge。
5. 真实 CLI 成功后使用：

```bash
python3 "$PT" archive-finalize --ticket manager/runtime/archive-tickets/<ticket>.json \
  --destination openspec/changes/archive/YYYY-MM-DD-<id>
```

6. finalize 检查活动目录已消失、新归档内容与验证快照一致、旧归档未被修改、非主规格的代码未变，并执行主规格校验。
7. 成功后创建独立 completion record，更新计划 done 并封存新目录。中断可重试同一 ticket，不能先手改 phase 来“修复”漂移。

由于权限配置默认只读，步骤 4–7 在明确授权 operator 上完成；这不是让普通 Manager 临时获得整个历史目录写权限。
已有流程直接归档但未建 ticket 时不可盲目 advance，应先审计并恢复可信证明或人工迁移，不伪造原始验证。

## Stage B：剪枝

用户明确要求清理时，`prune --change <已完成ID...> --decision-ref <批准引用>`。
工具先保留快照及完成凭证，再移出活动计划、裁剪 waves/batches 和不再被引用的 requirements。
活动消费者依赖通过 completion record 或可验证 legacy archive index 解析，不因剪枝丢失。
Cancelled、无法定位原归档、缺失/被修改的历史记录，均不能作为成功依赖。

## 输入快照与公共定义

按 [输入契约](../manager-plan-from-doc/references/input-contract.md)，本次归档准备阶段用 resolve-inputs 捕获当前消费者完整定义，随本次完成记录保存；不能只保留指向可变 plan registry 的 ID。
归档快照创建后不从最新 registry 重建或覆盖。旧归档不参与 normalize-inputs，也不补写新字段。
剪枝顶层 inputs 前检查剩余活动 input_refs，仍被使用的定义必须保留。只移除本次移出条目后不再有消费者的定义，不顺手清理无关资料。
此规则由归档实现接入有效输入输出，不能在尚未接入时声称旧凭据自动包含公共定义。

## 归档保护

普通操作：Codex 权限 read-only＋AGENTS/Skill 规则＋摘要检查。
CI：`scripts/archive_guard.py --base <可信基线commit> --head <候选commit>` 检查旧归档目录内的增删改，允许新的完整归档单元。
将 CI 检查设为受保护规则；不得允许候选 PR 顺便改 guard 然后自行判定通过。
对旧归档发现错误，在新 change 中修正行为/主规格，不能改写历史事实。

## 共同边界

遵守 [Manager 总体工作流](../MANAGER-WORKFLOW.md) 和项目 AGENTS.md。这里只修改被明确授权的文件。
不修改第三方 CLI 生成的 OpenSpec Skills，不私自 git add/commit/push、部署、发布或归档。
归档目录永远不是普通修复的写入目标。状态只通过 plan_tool.py 修改。
真实工具、模型、浏览器或验证不可用时明确报告，不模拟已经执行。
