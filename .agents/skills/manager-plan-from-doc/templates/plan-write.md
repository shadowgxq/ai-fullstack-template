# 计划写入检查

使用结构化 YAML 读写，不用字符串删除大片内容。只追加批准的新工作；修订已有需求走 manager-revise-plan。
写入前备份，保持 IDs、clauses、input_refs、inputs 的定义与 scopes、dependencies 和预览一致。可执行新工作为 change/planned；已定义但缺关键前提的工作为 change/blocked 并写明 blockers。
策略 requested/source/resolved 与证据写入 manager/runtime/planning/<id>.md；一次参数覆盖不改 policy。完整规划不等于生成所有 OpenSpec 制品。
只写获批准的 checkpoint / planning_boundary；缺省 checkpoint 保持 manual。只移除预览明确列出且获批准的已解决旧边界，不修改其他活动状态或历史；边界改变需新运行授权。
先分类来源：规范走 AGENTS/角色路由，源码走调查，PRD/技术/UI 基线复用专用字段，不因“必需输入”标题复制进 inputs。
相同定义在顶层 inputs 只声明一次，消费者使用 input_refs；同名不同定义不能覆盖，先明确消费视图与批准。
运行 validate --strict-inputs；逐 Change 用 resolve-inputs 核对消费者、必需性和范围。未来生产输入保留真实依赖，不伪造现成文件。
已有重复结构用 normalize-inputs 预览；分类警告仍需复核，结构去重不等于语义审查。
逐条核对 acceptance，检查共享 requirement 是否混入未来未交付页面。对承诺范围外的路线图保留来源及再规划条件，不冒充已细化。
覆盖证据外置，计划不存文档/图片/HTML 正文；不更改已批准 PRD marker 记录执行状态。
