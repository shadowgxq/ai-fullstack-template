# 角色、初始化与执行协议

## 权威来源

`manager/roles.yaml` 只定义路由；项目 `.codex/config.toml` 和 `.codex/agents/*.toml` 定义模型、权限和指令。全局 Skill 中的 `templates/project` 仅是模板，不自动安装。当前 Codex 支持独立角色文件自动发现；已有 `config_file` 注册可继续使用，但不能指向错误文件或与角色描述冲突。

首次接入先预览 `scripts/init_manager_project.py <project>`，获安装授权后加 `--write`。它仅创建缺失文件，保留所有同名配置，不动 PRD、计划、runtime 或凭证；已有定制配置需要合并差异。权限模板与项目已有旧 sandbox 配置不能混用。新建项目缺 roles.yaml 的问题由完整模板解决，不由默认 Agent 静默兜底。

执行前运行 doctor；它核对 change/apply/verify 路由、实际 execution.yaml 角色、TOML、权限 profile 和并发容量。用 `resolve-role --role <name>` 展示本地配置模型/effort 及来源，不创建计划或 runtime。原生运行时仍须核对实际可用 agent_type、账号模型、权限、OpenSpec 版本与浏览器工具。

## 分工

| 职责 | 默认角色 | 模型策略 |
| --- | --- | --- |
| 编排、批准引用、计划和制品单写、集成 | Manager 主线程 | Sol/xhigh |
| 产品边界及需求判断辅助 | product-manager | 继承 Sol |
| 技术方案、契约、Change 草稿 | architect | 继承 Sol，只读返回草稿 |
| 主力实现、复杂测试和定位 | backend-dev / frontend-dev | 继承 Sol，claim 后写入 |
| 最终独立代码/契约/安全审查 | reviewer（verify 路由） | 继承 Sol，不能是实现线程 |
| 查入口、符号、依赖、资料 | explorer | Luna/max，只读调查 |
| 已明确断言的有限测试实现 | test-worker | Luna/max，复杂策略交给 Sol |
| 按既定检查执行测试并取证 | qa | Luna/max，不替代最终 Reviewer |
| 明确基线下的交互、截图和偏差取证 | ui-ux-reviewer | Luna/max，方向判断交给 Sol/用户 |

只调用任务需要的角色，不要求九个角色每轮都运行。职责与权限独立于模型大小；升级模型不扩大写入范围。显式角色 model/effort 会覆盖此前解析的 spawn/default 值，因此轻角色升级应选择现有 Sol 角色/经批准配置，不假定 spawn 参数一定能压过角色文件。

## 写入、失败与恢复

原生写入 Worker 必须有 execution.yaml，即使串行仅一项。图与 tasks.md 的唯一 ID、needs、reads/writes、resources、acceptance 在 change gate 前确定。先创建等待任务的真实原生线程，记录 ID，task-claim 后才发写入任务；Worker 不改控制/规格文件，不勾任务。Manager 用 task-finish 核验并单写结果。

无图仅用于经明确许可的 Manager 直接串行实现；无法派发角色不能模拟多 Agent。缺独立 Reviewer 或必需验证，仍报告 blocked/inconclusive，不以串行授权免除验收。任务失败 block，有限修复或显式 reopen 后再执行；reopen 保留代码/原证据/预算，将旧 claim 标为 superseded 并重置勾选，重新检查再完成。

真实新产品决策、权限扩大、关键方案变化仍交给用户。与已批准方案一致且已有授权覆盖的普通制品可引用该批准，不能把 Agent 建议当作人工批准。auto checkpoint 不是产品验收，归档/合并/部署独立授权。

## 验证范围

configured/requested 模型是项目可见配置；observed 模型必须来自原生运行证据，不可见时为 null。本控制器不完整模拟用户级/管理层/CLI/运行中覆盖，不认证模型、身份或产品验收。符号权限与本地 hash 不是对抗恶意进程的安全边界；隔离与真正权限由 Codex/操作系统提供。

核对的官方文档（2026-09-24）：
- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://learn.chatgpt.com/docs/config-file/config-reference

这些原生能力以实际安装客户端和账号能力为准。模板静态检查通过，不等于真实模型调用、浏览器验收或生产可用性已通过。
