# 全栈初始化需求

## REQ-MONO-001：一个可运行 monorepo

范围：保留前端/后端已有基座；统一 frontend、backend、ai-service 目录，根启动/检查/CI 入口，独立依赖锁与环境。

验收：干净 checkout 可构建并启动三个服务与独立 Worker；前端可读取静态资源并代理认证接口；后端完成真实 PostgreSQL 注册/登录及 Redis 登出失效；数据库按服务隔离。命令与环境示例可复现。

## REQ-DOC-001：精简入口与文档单源

根/各端 AGENTS 只保留公共规则和路由，每份不超过 60 行。需求、架构、契约、进度统一在根目录；专业细则按需读取。历史业务示例与当前计划分离。

验收：链接与计划引用有效；变更影响矩阵可追踪到需求、schema、tasks、测试；代码导出的 OpenAPI 与提交快照一致；保留专端规范，不维护第二份公共规则。

## REQ-AI-001：运行时初始化

依照当前架构落地 Python/FastAPI、LangGraph、PostgreSQL、单 API/单 Worker。默认不联网调用模型，包含确定性工作流与公开 DTO。

验收：受信认证、scope 隔离、输入校验；同键同内容幂等、不同内容 409；API 不执行图；Worker 从持久命令执行并存 checkpoint；checkpoint 后发布前崩溃可恢复；第二 Worker 被阻止；结果不可覆写；迁移可重复执行；真实 PostgreSQL 集成测试及独立进程 smoke 通过。

非目标：完整业务页面、生产多租户、真实模型、外部调用台账、预算、SSE、人工审批、取消、产物存储及多 Worker 扩容。
