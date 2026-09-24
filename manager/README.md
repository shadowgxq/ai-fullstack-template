# Manager 项目接入

`plan.yaml` 为 v2 空计划，不带历史业务、批准或运行状态。`policy.yaml` 只配置本项目已有检查与资源上限，`roles.yaml` 的 change/apply/verify 路由到根 `.codex/agents`，verify 使用独立 reviewer；精确执行机制来自 [已固定 Skills](../.agents/skills/MANAGER-WORKFLOW.md)。

从仓库根运行 `python3 scripts/manager/plan_tool.py --capabilities`、`validate --strict-inputs`、`doctor`。两包装入口使用同一份 `.agents/skills/manager-execute-current-batch/scripts`，无第二套阶段枚举。Python 3.11+、PyYAML、真实 OpenSpec CLI 必须可用；安装方法见 [工具说明](../docs/engineering/workflow/tooling.md)。

源码与例程版本由 `scripts/manager/upstream.json` 固定；禁止只换 SKILL.md 或单独改某个 runtime 模块。项目业务路径为 `docs/product`、`docs/architecture`、`docs/contracts`，不创建上游示例路径的第二份文档。

`runtime` 的批准、状态、claims、ticket、证据摘要与预算必须持久保存并备份；Git 不再忽略整个 runtime，但日志/大文件和秘密不能提交。模板没有业务运行记录；应用项目提交前核对授权、敏感数据及证据存储方式。`control.lock` 不入 Git，进程退出前不删除。archive 完成凭证与旧历史保留；不要通过清空 runtime 重置预算或批准。

本项目 apply checks 执行完整 `make check` 和前端 build；涉及 UI 另需对应浏览器证据，跨端或运行配置变更执行 web-only/整栈 smoke。原生角色、模型、沙箱是否真实可用由操作者预检；doctor 不是实际模型执行证明。

角色配置预检用 `python3 scripts/manager/plan_tool.py resolve-role --role reviewer`；原生写入 Worker 使用已声明 execution.yaml 并先 claim。初始化器只补缺失配置，不修改已有业务计划或批准，说明见 [工具入口](../docs/engineering/workflow/tooling.md)。
