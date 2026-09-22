# 工具入口与上下文

[交付流程](delivery.md) 定义协作规则，本页只维护工具可用性、资料路径、状态兼容和归档边界；它们不是后台调度服务。

## 当前工具能力

根 `AGENTS.md` 为主入口，`CLAUDE.md` 仅转引；各端入口与公共规范保持不变。仓库内的 OpenSpec/repair skills 单源位于 `.agents/skills/`；操作者安装的 Manager skills 来自外部版本，不默认已安装，也不复制一套正文到本仓库。

| 层 | 已存在 | 不代表 |
|---|---|---|
| OpenSpec | 已提交 9 个生成 skill：propose/explore/apply、new/continue/ff、verify/sync/archive；元数据 generatedBy 为 1.2.0 | 操作者 CLI 就是该版本，或默认 profile 一定包含全部命令；当前未包含 update skill |
| 项目检查 | `make docs`、`make architecture`、各端 check/契约/启动检查 | Manager 调度、内容批准、task claim 或新鲜 gate receipt |
| Manager 索引 | `manager/plan.yaml` 与只读校验器 | Manager v2 控制面或 v2 plan 兼容 |

上游对照版本为 [skills@9bd7ea0](https://github.com/shadowgxq/skills/tree/9bd7ea0fe2c0d0270dbfbcd9b4fc927f6f2c0349)，文档标记 `2.0.0-rc.1`。该提交的 [执行 Skill](https://github.com/shadowgxq/skills/blob/9bd7ea0fe2c0d0270dbfbcd9b4fc927f6f2c0349/manager-execute-current-batch/SKILL.md) 已要求 doctor、批准、claim、gate、session、归档凭证；但 [plan_tool.py](https://github.com/shadowgxq/skills/blob/9bd7ea0fe2c0d0270dbfbcd9b4fc927f6f2c0349/manager-execute-current-batch/scripts/plan_tool.py) 仍只注册 next/start/advance/block/set-review/repoint-current/validate，且缺少文档引用的 `MANAGER-V2-MIGRATION.md`。**该远端版本不能直接作为完整 v2 执行包；本模板未启用 v2 自动执行。**

操作者另有版本时重新核对其实际文件、CLI help、配置与测试，不凭相同 skill 名或 approved 字符串放行。完整迁移须同时处理控制脚本、项目策略/角色、plan 校验和归档保护；不能只更新文档后宣布完成。

## OpenSpec 命令发现

执行前检查 `openspec --version`、`openspec --help` 和实际可用 skills。聊天中的 `$openspec-propose` 等是 Codex skill 调用，不是终端子命令；`openspec update` 是 CLI 工具文件更新，不是需求修订。

[官方命令参考](https://github.com/Fission-AI/OpenSpec/blob/main/docs/commands.md) 的 core 路径是 propose/explore/apply/update/sync/archive；ff/verify 等属于可选扩展。仓库携带的旧生成文件与当前 profile 不必一致，不能仅照网页假设命令存在。

需要新命令时，经授权用 CLI 的 profile/update 流程重新生成并审查差异，保留项目 `openspec/config.yaml`；不手改第三方生成 Skill。当前无 update skill 时，在主线程按 [受控修订](delivery.md#并行goal-与失败) 明确修改目标活动制品并复核一致性，不声称调用了不存在的命令。完整 Manager 模式还须走该版本的修订/失效机制。

## 资料与状态归属

| 内容 | 本仓库位置与规则 |
|---|---|
| 产品行为与验收 | `docs/product/`，稳定 REQ-ID；不含模板维护记录 |
| 系统基线 / 业务技术方案 | `docs/architecture/`；业务方案按需用 `<area>/overview.md` 与 `features/<feature>.md`，只展开复杂部分 |
| UI 批准基线 | 引用实际设计稿、原型或业务方案中的视觉基线；不创建空设计目录 |
| API 契约 | `docs/contracts/`；schema 由提供方代码生成 |
| 本次差异与任务 | `openspec/changes/<id>/`，design 引用批准方案而非复制；tasks 由唯一协调者更新 |
| 活动索引 | `manager/plan.yaml`，不堆日志、截图或逐任务运行状态 |
| v2 运行配置与记录（接入后） | `manager/policy.yaml`、`manager/roles.yaml`、`manager/runtime/`；复杂 change 才有 `execution.yaml` |
| v2 完成凭证（接入后） | `manager/archive/completed/`；剪枝后仍可解析历史成功依赖 |

调用外部 Manager 时明确本仓库目录映射，不因上游默认目录再复制 PRD/技术方案。工具不支持映射时先适配，不冒充已支持。schema、证据结构和精确命令以已验证的外部 Skill 版本为准，本页不维护第二份完整说明书。

模型、账号权限和并发配置属于操作者环境，不写入模板默认值。`manager/runtime/` 已被 Git 忽略，实际验收证据需在 PR 或持久制品中留下可访问引用；关键完成凭证不能只留在临时环境。当前内容卫生检查仍拒绝 `manager/roles.yaml`，真正接入 v2 时须评审替换该旧限制并补测试，不能删除检查来伪装接入。

## 当前兼容模式

尚未完成 v2 迁移时，使用明确的人工/单 change 流程，不运行外部 v2 自动 Manager/Goal，也不手工伪造其批准、claim 或 gate 文件。本地 [校验器](../../../scripts/manager/validate_plan.py) 只支持下列旧索引；它不是上游 plan_tool，也不执行命令或证明人工批准。

| 本地 phase / state | 含义 |
|---|---|
| `plan / planned` | 已有可定位 change 与 tasks 的计划记录 |
| `apply / in_progress` | 实现中 |
| 原阶段 / `blocked` | 停止推进、待处理阻塞 |
| `verify / ready_for_review` | tasks 完成且有 verification.md，仍需实际评审 |
| `archive / archived` | 已由真实归档操作完成并校准引用，不代表发布 |

保持当前空索引；登记时保留 updated_at/current/requirements/openspec/batches，change 明确 requirements/path/tasks/depends_on，支持资料通过 inputs 引用；进入 review/archive 时 tasks 全部完成且有真实 verification.md，归档后同步 path/tasks，current 不再指向归档项。纯规划预览先记在现有方案或 PR，OpenSpec 生成真实制品后再登记；不能为使校验通过提前勾 tasks、造占位证据或改动已批准 PRD。

上游 v2 使用 `change → apply → archive → done`、`in-progress` 等字段，支持紧凑路径与外置历史凭证；当前本地校验器不兼容这些语义。不要直接写 version: 2、替换阶段名或剪掉历史依赖。涉及取消、自动修订或 v2-only 状态时停止迁移并保留原记录；完整工具接入前不得把旧批准迁移成可信新凭证。

## 显式归档与剪枝

归档、Git 合并和上线发布分别授权，不互为完成证明。归档要求本 change 验收通过、证据对应当前内容、没有运行中的写任务，并获得单独授权；普通 Manager/Worker 不改历史或擅自同步主规格。

归档使用实际可用的 `openspec archive <id>`（参数先核对 `--help`；非交互 `--yes` 不替代授权），由 CLI 验证、同步增量主规格并归档。禁止以手工 mv、手写 spec merge 或 `--no-validate` 绕过流程。仓库旧 archive skill 仍描述手动移动，新任务不采用该路径，也不手工改写生成文件；不能安全使用实际 CLI 时停止，不静默退回旧路径。

完整 v2 模式须由授权 operator 使用该版本的 prepare/finalize 与持久完成凭证，成功后才允许显式 prune；当前兼容模式记录实际命令/结果并校准索引，不宣称已有 ticket/seal/guard。旧索引仍被 depends_on 引用的记录不得剪除。已归档目录不再改写，必要链接在归档前处理，行为变化用新 change；失败中断先核对实际文件，不先手改状态成成功。

精确 v2 机制见 [归档 Skill](https://github.com/shadowgxq/skills/blob/9bd7ea0fe2c0d0270dbfbcd9b4fc927f6f2c0349/manager-archive-completed/SKILL.md)，原生命令见 [OpenSpec CLI](https://github.com/Fission-AI/OpenSpec/blob/main/docs/cli.md)。模板发布清理与使用方历史保留按 [文档维护规则](../../README.md#文档维护规则) 区分，删除模板记录不授权改写使用方归档。
