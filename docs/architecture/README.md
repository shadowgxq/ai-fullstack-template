# 全栈架构与落地边界

## 来源与职责

| 原目录 | 当前目录 | 职责 |
|---|---|---|
| frontend-agent-template | `frontend/` | UI、路由、状态、HTTP 消费者 |
| backend-agent-template | `backend/` | 用户/认证、业务 API、事务与授权 |
| ai-server（主分支此前替换 Company Lens） | `ai-service/` | Run 生命周期与 Agent 执行 |

模板能力是主题、i18n、认证、工程约束、运行协议；业务工作流、实体、提示词、页面与评估属于具体产品。历史记账 PRD 仅保留在 examples，不混入当前初始化。Company Lens 不重新恢复。

## 运行与数据边界

目标业务链路：浏览器 → backend（用户授权、业务资源）→ ai-service API → PostgreSQL 命令 → 独立 Worker → LangGraph → 正式结果。

**当前实际链路**：前端模板与后端认证可启动；smoke 客户端直接验证受信 AI API→Worker→结果。尚未实现业务 Run 页面或后端到 AI 的鉴权转发，不宣称完整产品业务闭环。

backend 与 ai-service 同机分库、分角色；不直接读写对方数据。Redis 仅支持既有后端认证/缓存，不是 AI 队列。PostgreSQL 应用表管理命令/Run/事件，LangGraph 表管理图位置。两类迁移分别维护，显式执行。

monorepo 共用 Git、文档、任务、Compose/CI；各端保留独立 pnpm/uv 锁与环境。当前只有一个 JS 应用，不额外引入 workspace/Turborepo；两个 Python 服务不合并虚拟环境，不依赖隐式跨包导入。

## 当前落地

AI 的配置校验、Bearer 服务认证、可信 scope、Pydantic DTO、幂等创建/冲突、持久命令/事件、单 Worker 会话锁、实际 LangGraph checkpoint、崩溃后恢复、不可覆写终态、健康/就绪、Docker/测试已加入初始化代码。只注册无外部调用的 echo.v1。

## 保留为目标

[通用 Runtime 架构](ai-service/agent-runtime-architecture.md) 与其中 ADR 是扩展基线，不是完成清单。预算/外部调用台账/unknown、人工回答、取消、修订、SSE、Artifact Store、实时模型、生产多租户、多 Worker fencing 仍待实现。远端请求与 checkpoint 不构成原子事务，不承诺远端 exactly-once。

根 Compose 使用开发凭证且仅监听 loopback；公网部署必须重新完成认证、授权、限流、日志脱敏、TLS、备份和依赖故障策略评审。
