# 工具入口与上下文

## 安装与唯一机制

Manager 固定为 `shadowgxq/skills@6625edca2397a4f67d6ca82dace0bd0a41c08243`，控制器 2.0.0。项目内八个 Manager Skill、9 个 runtime 模块、相关引用与测试作为同一版本安装于 `.agents/skills`；[摘要清单](../../../scripts/manager/upstream.json) 校验来源。完整机制只看 [Manager 工作流](../../../.agents/skills/MANAGER-WORKFLOW.md) 和 [安装/迁移](../../../.agents/skills/MANAGER-V2-MIGRATION.md)，本页不复制它们。

OpenSpec 使用 `@fission-ai/openspec@1.13.1`，core profile 的 6 个 Skills 由真实 CLI 生成：propose、explore、update、apply、sync-specs、archive。`.agents/skills/.openspec-target` 保留官方标记；不要手工改生成 Skill，升级使用相同 CLI 的 init/update 并复验。自定义 Manager/repair 不放到 frontend 下。

```bash
npm install --global @fission-ai/openspec@1.13.1
openspec --version
uv run --no-project --with PyYAML==6.0.3 python scripts/manager/plan_tool.py --capabilities
uv run --no-project --with PyYAML==6.0.3 python scripts/manager/plan_tool.py validate --strict-inputs
uv run --no-project --with PyYAML==6.0.3 python scripts/manager/plan_tool.py doctor
```

`--help` 是当前命令参数的事实源；没有原生模型、浏览器或 CLI 时明确报告，不模拟。项目控制入口和结构 validator 都委托同一 runtime；不存在另一套旧 plan/apply/verify 状态机。

## 本项目配置

- [plan](../../../manager/plan.yaml)：v2 空计划，planned change 可以尚无制品。validate 只结构校验；start/gate 再查真实来源、批准、执行和证据。
- [policy](../../../manager/policy.yaml)：auto 规划默认、4 个角色线程/2 个写任务、900 秒检查上限；实际 apply checks 为 `make check`、前端 build。OpenSpec strict validate 仍由机制内置，不放 `true` 替代。
- [roles](../../../manager/roles.yaml) 与 `.codex/agents`：业务路径引用本仓库 docs。主模型及四个轻量角色采用固定上游原生配置；安装、静态配置正确不证明账号可访问模型。操作者核对实际客户端后调整配置并同步审查，不虚构 observed model。
- `.codex/config.toml`：项目级配置，角色文件自动发现，默认保护计划/历史、仅允许 loopback 网络；包安装/外部 API 域名需显式授权。frontend/backend/ai-service 私有 env 禁止读；不覆盖个人全局配置。

新增安装使用 `.agents/skills/scripts/init_manager_project.py <project>` 预览；明确授权后 `--write` 仅补缺失文件，已有项目配置需合并，不能整体覆盖。本项目的 `change/apply/verify` 路由分别对应方案、实现与最终独立 reviewer；QA 负责取证，不代替最终 reviewer。`resolve-role --role <name>` 只报告配置，不证明真实模型已运行。完整约束见 [角色协议](../../../.agents/skills/manager-execute-current-batch/references/role-contract.md)。

运行状态/批准/claims/ticket/预算持久化及保密要求见 [Manager README](../../../manager/README.md)。计划正文保持紧凑，日志、大截图不塞进 YAML。

## 检查入口

`make docs architecture` 校验项目导航、规则与边界；`make manager-check` 校验源码摘要、capabilities、doctor 及上游控制测试；`make manager-live` 增加真实 OpenSpec 生命周期测试。上游用例中的身份和 Agent 是显式测试替身，不代表原生派发。

`make check` 执行三端静态与测试、契约；`make up-web && make smoke-web` 验证前后端，`make up && make smoke` 验证完整栈。浏览器安装与命令见 [浏览器验收入口](../../../scripts/browser/README.md)。UI Gate 需要相应基线、真实操作和独立 review；浏览器 smoke 不是全部未来业务验收。

## 显式归档与剪枝

使用 [归档 Skill](../../../.agents/skills/manager-archive-completed/SKILL.md) 的 prepare → 授权 operator 执行真实 OpenSpec archive → finalize，再按真实授权 prune。只有完成凭证可满足被剪枝依赖；不得手动搬目录、修改已封存的字节或清空状态解锁。空模板不保留 archive 根 `.gitkeep`，因为控制器要求其子项为完整归档目录。

## 更新边界

升级时固定新上游提交，整体替换上述机制及相应测试，重新生成官方 OpenSpec Skills，适配项目 policy/roles/校验和导航；核对差异后更新摘要。不要恢复过时控制器、复制所有不相关社区 Skills，或把项目安装授权写成业务批准。
