# 工具入口与上下文

## 安装与唯一机制

Manager、设计与 repair Skills 复用全局安装，项目不保存同名副本、第三方快照包或安装摘要。通用 Skills 的来源为 [shadowgxq/skills](https://github.com/shadowgxq/skills)，由使用方统一安装和更新；项目维护业务文档、计划、设计资产、修复队列与工程约束。

| 全局工具 | 读取内容 |
|---|---|
| 八个 `manager-*` 入口 | 对应 `SKILL.md`、`MANAGER-WORKFLOW.md` 与必要引用、模板和脚本 |
| `ui-ux-delivery`、`pencil-design`、`design-to-code`、`design-qa` | 对应 `SKILL.md`、`DESIGN-WORKFLOW.md` 与必要引用、脚本和资源 |
| `repair-intake`、`repair-runner` | 对应 `SKILL.md`，结合项目 `repairs/` 约定与校验器 |

Codex 用户级安装目录为 `$HOME/.agents/skills/`。执行时以客户端提供的实际 Skill 路径为准，先确认入口可发现，再从该安装位置读取共同协议及必要引用。Manager 与设计入口及共同文件保持同一来源的完整安装，不在项目文档复制执行流程。缺少入口或依赖时报告具体缺项，由使用方补齐全局工具，不自动建立项目副本。

Pencil MCP / CLI 连接与工具说明按实际环境核对，安装 Skills 不会自动安装 Pencil。

OpenSpec 使用 `@fission-ai/openspec@1.13.1`，全局尚未提供的 core profile 六个 Skills 保留在项目 `.agents/skills/`：propose、explore、update、apply、sync-specs、archive。这些入口由真实 CLI 生成，`.agents/skills/.openspec-target` 保留官方标记；不要手工改生成 Skill，升级使用对应 CLI 的 init/update。

```bash
npm install --global @fission-ai/openspec@1.13.1
openspec --version
```

原生命令参数以实际安装版本的 `--help` 为准。当前 Change 的制品可使用 `openspec validate <change-id> --strict --no-interactive` 校验；检查失败如实记录，不模拟工具或测试结果。

## 项目初始化入口

[project-init](../../../.agents/skills/project-init/SKILL.md) 是随本项目维护的轻量入口，按 [项目初始化规范](../frontend/guides/project-bootstrap.md#复制模板后的项目初始化) 执行模板产品化清理或视觉重建，并按影响读取必要规范；不是全局设计 Skill 的副本，也不参与普通需求的自动调度。

在 Codex 中使用 `$project-init` 显式调用；其 `agents/openai.yaml` 设置 `policy.allow_implicit_invocation: false`，不依赖描述文字阻止自动匹配。机制见 [官方 Skill 元数据](https://developers.openai.com/codex/skills/)。复制时保留 `.agents` 目录；入口未被客户端发现时先检查项目路径并重新加载，再核对可用性，不宣称仅写入文件就已加载。

## 执行与审查

只保留执行与审查两个职责，不需要项目 `.codex/config.toml`、固定角色文件、模型路由或角色初始化器。当前会话协调实现，依赖已满足且写入范围互不冲突的工作可由原生通用 subagent 并行处理；共享文件和未确定契约按依赖顺序执行。协调会话核对真实 diff，单写 tasks、Plan 与进度。

默认由一个独立只读 Reviewer 审查实际 diff、契约和已有检查证据；用户明确 `review=off` 时可以省略。职责种类不限制实现线程数量。每个 Change 检查与所需审查完成后及时回写 code-verified，阶段末再补必要集成检查。没有实际独立审查线程时报告未完成，不能将自查写成独立审查通过。模型与权限由宿主会话提供，Manager 不另行覆盖。

## 计划与检查入口

[项目计划](../../../manager/plan.yaml)、progress、tasks、runtime 证据和归档保留既有记录。旧计划不会因全局工具更新被改写，也不作为 docs/CI 的 Manager 版本门禁；新建或实质修订计划时按全局 `manager-plan-from-doc/references/plan-format.md` 使用其只读结构检查。该检查不证明业务实现或人工验收通过。

`make docs architecture` 校验项目导航、规则与边界。`make check` 保留三端静态检查、业务测试与契约校验；`make up-web && make smoke-web` 验证前后端，`make up && make smoke` 验证完整栈。实际验证范围遵守根 AGENTS 和当前授权；文档与 Skill 说明变更按 [文档检查范围](../common/README.md#验证范围) 验证，不因此启动业务服务或全栈验收。

CI 的 Manager job 使用固定版本 OpenSpec 校验当前 changes 与 specs：`openspec validate --all --strict --no-interactive`。它不依赖开发者的全局 Skills，不解析 Manager 计划，也不重新验收归档任务。

代码与逻辑检查、独立审查、人工产品验收分别记录。浏览器协助仅在当前任务明确授权时使用；入口见 [浏览器验收入口](../../../scripts/browser/README.md)。

## 显式归档与剪枝

使用全局 `manager-archive-completed` 核对代码检查、所需人工验收与本次授权，再执行真实 OpenSpec archive。归档、PR 合并和生产发布分别授权；不得手工搬目录、改写已封存内容或伪造验收。历史记录保留，不因工具升级剪枝。

## 更新边界

通用 Skills 在全局安装位置统一更新，Manager 与设计入口及共同流程、引用、模板、脚本和必要资源按同一来源整体更新。OpenSpec 官方 Skills 通过其 CLI 单独更新；将来全局提供同名入口时，项目不重复保留。项目工程命令、业务代码、计划与历史证据不随全局工具自动重写。
