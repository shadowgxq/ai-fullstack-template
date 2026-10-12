# 工具入口与上下文

## 安装与唯一机制

Manager 与设计 Skills 来自 [shadowgxq/skills](https://github.com/shadowgxq/skills) 的 `master` 提交 `5cc2205b4c692f31317da8f472bf156ae2c8393e`，未包含工作树修改。模板已将八个 Manager 入口、四个设计入口、共同流程及完整引用/脚本/资源安装于 `.agents/skills`。完整机制分别见 [Manager 工作流](../../../.agents/skills/MANAGER-WORKFLOW.md) 与 [设计工作流](../../../.agents/skills/DESIGN-WORKFLOW.md)。

| 安装内容 | 声明版本 |
|---|---|
| 八个 `manager-*` 入口 | `4.0.0` |
| `ui-ux-delivery` | `5.0.0` |
| `pencil-design` | `2.0.0` |
| `design-to-code` | `1.2.0` |
| `design-qa` | 未声明独立版本；以同一提交和摘要锁定 |
| `MANAGER-WORKFLOW.md` / `DESIGN-WORKFLOW.md` | 与上述入口使用同一提交 |

可复现依赖包为 [source.zip](../../../scripts/design-skills/source.zip)，包含上述 Manager 与设计安装内容；[包清单](../../../scripts/design-skills/upstream.json) 记录 `snapshot-5998d58f8477`、来源提交、包及逐文件 SHA-256。[安装摘要](../../../scripts/manager/upstream.json) 核对实际安装文件，不以声明版本代替内容校验。规则维护回到来源仓库，模板按同一提交整包同步。

需要独立安装时，先校验包，再将完整内容放入 `.agents/skills/` 并保持相对结构；以下解压命令只适用于目标入口尚不存在的安装。已有同名项目或用户级 Skill 时先核对来源与摘要，复用匹配版本或整体升级受影响目录，保留无关入口与用户修改。模板使用真实文件安装，以便摘要检查识别漂移。

```sh
set -e
python3 - <<'PY'
import hashlib, json
from pathlib import Path
bundle = Path('scripts/design-skills')
manifest = json.loads((bundle / 'upstream.json').read_text())
assert hashlib.sha256((bundle / 'source.zip').read_bytes()).hexdigest() == manifest['archive_sha256'], 'Skill archive checksum mismatch'
PY
python3 -m zipfile -e scripts/design-skills/source.zip .agents/skills
make manager-check
```

安装后在客户端技能选择器确认十二个入口可发现，并实际读取本次 Skill、共同协议及必要引用；未出现时按客户端机制重新加载。Pencil MCP / CLI 连接与工具说明按实际环境核对，安装 Skills 不会自动安装 Pencil。

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

`make docs architecture` 校验项目导航、规则与边界；`make manager-check` 只检查已固定的 Manager/设计 Skills 安装文件摘要。`make check` 保留三端静态检查、业务测试与契约校验；`make up-web && make smoke-web` 验证前后端，`make up && make smoke` 验证完整栈。实际验证范围遵守根 AGENTS 和当前授权；非运行时文档变更只审查 diff，不因安装或流程说明更新运行自动化测试与全栈验收。

CI 的 Manager job 使用固定版本 OpenSpec 校验当前 changes 与 specs：`openspec validate --all --strict --no-interactive`。它不解析 Manager 计划，也不重新验收归档任务。

代码与逻辑检查、独立审查、人工产品验收分别记录。浏览器协助仅在当前任务明确授权时使用；入口见 [浏览器验收入口](../../../scripts/browser/README.md)。

## 显式归档与剪枝

使用 [归档 Skill](../../../.agents/skills/manager-archive-completed/SKILL.md) 核对代码检查、所需人工验收与本次授权，再执行真实 OpenSpec archive。归档、PR 合并和生产发布分别授权；不得手工搬目录、改写已封存内容或伪造验收。历史记录保留，不因工具升级剪枝。

## 更新边界

Manager 八个入口与设计四个入口按同一来源提交整体同步共同流程、引用、模板、脚本和必要资源；同步依赖包、来源清单及实际安装摘要，避免旧入口或跨版本引用。OpenSpec 官方 Skills 通过其 CLI 单独更新。项目工程命令、业务代码、计划与历史证据不随工具包自动重写。
