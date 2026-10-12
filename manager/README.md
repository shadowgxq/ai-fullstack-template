# Manager 项目接入

本项目复用全局安装的 `MANAGER-WORKFLOW.md` 与八个 Manager Skills，由当前会话协调执行与维护进度。执行与审查是两个职责；独立且写入范围不冲突的实现可并行，默认由一个独立只读 Reviewer 审查实际 diff 与检查证据，用户明确 `review=off` 时可省略。不需要角色配置、模型路由或自定义执行控制器。

项目只维护计划、任务与执行证据，不保存通用 Skill 副本或安装摘要。全局 Skill 的实际读取路径、OpenSpec CLI 和业务检查入口见 [工具说明](../docs/engineering/workflow/tooling.md)。

`plan.yaml`、已有 progress、任务、runtime 证据与 archive 保留原有内容，不因工具版本变化自动迁移或重新验收。新计划与实质修订使用全局 `manager-plan-from-doc/references/plan-format.md` 定义的当前格式及只读结构检查；旧计划不参与 docs/CI 的 Manager 版本门禁。

恢复任务时只读取授权范围内的计划、任务与实际实现，复用仍有效的检查结果。状态由一个协调会话维护，实现 subagent 不改共享进度；不能通过清空 runtime、改写历史或虚构人工反馈宣称完成。项目业务来源仍为 `docs/product`、`docs/architecture`、`docs/contracts`。
