# 模板清理与架构复审

需求：[REQ-CLEAN-001](../../../docs/product/template-maintenance.md)。基于已合并 PR #1 后的主分支；保留新增团队小站需求，不将它当作已批准业务实现。

删除旧记账 PRD、设计稿、旧计划及未接入的执行脚本，收敛工具入口与任务生命周期。修正审查发现的事务、鉴权故障、错误泄漏和 Worker 检查点连接边界。保留 React/Vite、FastAPI/SQLAlchemy 与 LangGraph/PostgreSQL 选型，不搭建额外调度平台。

直接消费者：前端错误归一化、后端 API 调用方、AI Worker、CLI/skills、CI。行为变化：认证依赖不可用返回 503；凭证合法性约束进入 OpenAPI；不再以 OAuth2 表单流程描述 JSON 登录。

非目标：团队小站功能、公司研究业务、真实模型调用、生产多租户、负载/渗透验收。
