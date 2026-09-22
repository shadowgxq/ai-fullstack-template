# 全栈架构

## 项目关系

| 边界 | 拥有的能力 | 不承担 |
|---|---|---|
| `frontend/` | 页面、路由、主题/i18n、状态与 HTTP 消费 | 服务密钥、数据库操作、Agent 执行 |
| `backend/` | 用户认证、业务资源、授权、事务与公开 API | LangGraph workflow 执行、直接访问 AI 库 |
| `ai-service/` | Run 命令、快照、持久执行与 LangGraph Checkpoint 恢复 | 业务用户账户、前端页面、业务产品定义 |

三端是同一仓库的独立应用，不是三份独立项目模板。共用 Git、规范、产品需求、契约与交付流程，保留独立依赖锁和运行环境。只有一个 JS 应用，不引入额外 workspace/构建平台；两个 Python 服务不互相导入源码。

主题、认证、Run 协议属于模板；具体实体、页面、工作流、提示词、评估属于业务。只做 CRUD 的业务仅启动前后端；需要持久化任务执行时再接入 AI 服务。

## 工程规范的总分边界

规范组织与运行时架构分开：[公共代码质量](../engineering/common/code-quality.md) 定义命名、注释、复用与准确性；[公共 Python](../engineering/common/python.md) 只覆盖两服务的语言共性；[前端](../engineering/frontend/README.md)、[后端](../engineering/backend/README.md)、[AI](../engineering/ai-service/README.md) 分别拥有组件/状态、业务事务、持久执行的专项规则。

该划分不新增共享运行时包，不要求每个项目安装全部技术或实现所有目标能力。规则归属和冲突处理见 [文档地图](../README.md#规则归属)；各端公开类型、组件清单与当前能力仍以对应代码和事实源核对。

## 数据流与所有权

目标业务链路：浏览器 → backend（用户/资源授权）→ AI API（受信服务身份）→ PostgreSQL-backed Command Queue → Worker → LangGraph → 结果。

当前实际：前端基座代理后端认证；AI 由 smoke 客户端直接调用。尚无业务 Run 页面和 backend→AI 用户授权转发，不把服务都启动等同于业务贯通。

后端为同步 FastAPI → service → repository → model；API 装配鉴权依赖，service 拥有事务，repository 只 flush/query。core 只提供业务无关基础设施。Redis 缓存故障可回源，认证限流/撤销检查故障拒绝请求。

AI API 装配 `RunService(RunStore)`；application 依赖 core Protocol，不依赖 PostgreSQL 实现。Worker 通过 `bootstrap.create_runner` 注册并注入绑定 Saver 的 workflow；core 的 `WorkflowRunner` 仅分派注册 ID，不 import LangGraph。API 不执行 workflow。Run/命令同事务提交，事件与状态同事务提交；Checkpoint 独立提交，但与 Worker 排他锁、应用写入共享会话，连接丢失后停止推进。当前是单 Worker，不支持多 Worker 横向扩容。

PostgreSQL 同机分库分角色；应用表与 LangGraph 表分别迁移。Redis 不是 AI 队列。所有迁移显式执行，不在请求或应用启动中建表。

## 当前与目标

当前支持 `echo.v1`、静态注册与执行注入、配置校验、Bearer 服务认证、受信 scope、幂等冲突、持久命令/JSON 事件、显式 sync Checkpoint 与输入一致性保护、终态不可覆写、Worker JSON 日志、存活/就绪和包内离线自检。包入口、实现位置与验证命令见 [AI README](../../ai-service/README.md)，依赖版本以各端 lockfile 为准。离线自检不证明 PostgreSQL 或生产环境就绪。

[Runtime 扩展设计](ai-service/agent-runtime-architecture.md) 和其中 ADR 是目标，不是完成清单。Operation Ledger/预算/unknown、人工审批、取消、SSE、Artifact、真实模型、生产多租户及多 Worker fencing 尚未实现；不能直接把 echo 节点替换为付费调用。

Compose 仅本地使用开发凭证和 loopback 端口。公网部署另需 TLS、逐资源授权、配额、备份、观测与安全验收。启动命令只维护于 [根 README](../../README.md) 和各端 README。
