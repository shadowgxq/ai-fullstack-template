# Repair Pipeline

`repairs/` 用于小范围、可独立验证的修复。它是文档驱动队列，不是后台服务；与 Manager/OpenSpec 的任务分工见 [交付流程](../docs/engineering/workflow/delivery.md)。模板初始队列为空。

## 入口与唯一职责

| 入口 | 职责 |
|---|---|
| [repair-intake](../.agents/skills/repair-intake/SKILL.md) | 用户显式启用后，定位并登记问题，不执行修复 |
| [repair-runner](../.agents/skills/repair-runner/SKILL.md) | 选择任务、安排执行、独立验证、回写状态；具体调度与恢复规则由该 Skill 维护 |
| [repair-template.md](repair-template.md) | 单项修复的字段与记录结构，不是活动任务 |
| [list.yaml](list.yaml) | 选择范围与本轮执行索引，不重复保存问题正文 |

## 数据位置与状态

活动修复放在 `queue/repair-YYYYMMDD-NNN.md`；经用户确认并明确授权归档后，移入 `archive/`。单项文件记录复现、预期、修改范围、验证证据和阻塞信息。

| 状态 | 含义 |
|---|---|
| `todo` / `processing` | 待处理 / 已领取执行 |
| `fixed` | 工程验证完成，等待用户验证 |
| `verified` | 用户已确认，等待归档授权 |
| `blocked` | 需要补充信息或处理阻塞 |
| `archived` | 已归档的历史记录 |

进入队列的必要字段、合法状态迁移、恢复处理和 worker 边界以相应 Skill 与 [校验器](../scripts/repairs/validate_repairs.py) 为准。本页不复制执行提示词或另一套调度规则。

## 调用示例

以下只是调用方式，不建立活动任务，也不授予 Git 提交、发布、用户验收或归档权限：

```text
$repair-intake 描述需要登记的问题
$repair-runner 处理 repairs/list.yaml 中选定的修复
```

外部 goal 循环可以重复调用 runner；可执行项、退出条件和授权范围仍由 Skill 控制，仓库不提供后台循环服务。

## 队列检查

在仓库根目录执行：

```bash
python3 scripts/repairs/validate_repairs.py
python3 scripts/repairs/validate_repairs.py --status-only
```

指定单项时将实际文件路径追加到命令后。`--include-archive` 同时检查归档；`--status-only` 仅汇总状态，不代替严格校验。校验失败应修正记录，不能靠删除失败任务获得通过。
