# 工具入口与上下文

## 安装与唯一机制

Manager 使用 3.0.2 Skills，项目内八个入口、共同流程及必要引用安装于 `.agents/skills`。本地安装来自全局 Skills 工作树；[摘要清单](../../../scripts/manager/upstream.json) 记录基础提交、本地改动标记与逐文件摘要。完整机制见 [Manager 工作流](../../../.agents/skills/MANAGER-WORKFLOW.md)，不再使用自定义执行引擎。

OpenSpec 使用 `@fission-ai/openspec@1.13.1`，core profile 的 6 个 Skills 由真实 CLI 生成：propose、explore、update、apply、sync-specs、archive。`.agents/skills/.openspec-target` 保留官方标记；不要手工改生成 Skill，升级使用相同 CLI 的 init/update 并复验。自定义 Manager/repair 不放到 frontend 下。

```bash
npm install --global @fission-ai/openspec@1.13.1
openspec --version
make manager-check
```

原生命令参数以实际安装版本的 `--help` 为准。当前 Change 的制品可使用 `openspec validate <change-id> --strict --no-interactive` 校验；检查失败如实记录，不模拟工具或测试结果。

## 执行与审查

只保留执行与审查两个职责，不需要项目 `.codex/config.toml`、固定角色文件、模型路由或初始化器。当前会话协调实现，依赖已满足且写入范围互不冲突的工作可由原生通用 subagent 并行处理；共享文件和未确定契约按依赖顺序执行。协调会话核对真实 diff，单写 tasks、Plan 与进度。

默认由一个独立只读 Reviewer 审查实际 diff、契约和已有检查证据；用户明确 `review=off` 时可以省略。职责种类不限制实现线程数量。每个 Change 检查与所需审查完成后及时回写 code-verified，阶段末再补必要集成检查。没有实际独立审查线程时报告未完成，不能将自查写成独立审查通过。模型与权限由宿主会话提供，Manager 不另行覆盖。

## 计划与检查入口

[项目计划](../../../manager/plan.yaml)、progress、tasks、runtime 证据和归档保留既有记录。旧计划不会因升级工具被改写，也不再作为 docs/CI 的 Manager 版本门禁；新建或实质修订计划时按 [当前格式](../../../.agents/skills/manager-plan-from-doc/references/plan-format.md) 使用其只读结构检查。该检查不证明业务实现或人工验收通过。

`make docs architecture` 校验项目导航、规则与边界；`make manager-check` 只检查已安装 Skills 的文件摘要。`make check` 保留三端静态检查、业务测试与契约校验；`make up-web && make smoke-web` 验证前后端，`make up && make smoke` 验证完整栈。开发任务按实际改动范围选择必要检查，不因 Manager 安装运行全栈验收。

CI 的 Manager job 使用固定版本 OpenSpec 校验当前 changes 与 specs：`openspec validate --all --strict --no-interactive`。它不解析 Manager 计划，也不重新验收归档任务。

代码与逻辑检查、独立审查、人工产品验收分别记录。浏览器协助仅在当前任务明确授权时使用；入口见 [浏览器验收入口](../../../scripts/browser/README.md)。

## 显式归档与剪枝

使用 [归档 Skill](../../../.agents/skills/manager-archive-completed/SKILL.md) 核对代码检查、所需人工验收与本次授权，再执行真实 OpenSpec archive。归档、PR 合并和生产发布分别授权；不得手工搬目录、改写已封存内容或伪造验收。历史记录保留，不因工具升级剪枝。

## 更新边界

更新八个 Manager Skills 时整体同步其共同流程、引用、模板和只读计划检查，记录真实来源并更新文件摘要。OpenSpec 官方 Skills 通过其 CLI 单独更新。项目工程命令、业务代码、计划与历史证据不随工具包自动重写。
