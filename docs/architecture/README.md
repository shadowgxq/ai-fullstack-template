# 全栈架构

## 项目关系

| 边界 | 拥有的能力 | 不承担 |
|---|---|---|
| `frontend/` | 页面、路由、主题/i18n、状态与 HTTP 消费 | 服务密钥、数据库操作、Agent 执行 |
| `miniprogram/`（可选） | 微信页面、平台适配、移动主题与 HTTP 消费 | Web DOM/UI、服务密钥、直接调用 AI 或数据库 |
| `backend/` | 用户认证、业务资源、授权、事务与公开 API | LangGraph workflow 执行、直接访问 AI 库 |
| `ai-service/` | Run 命令、快照、持久执行与 LangGraph Checkpoint 恢复 | 业务用户账户、前端页面、业务产品定义 |

各端是同一仓库的独立应用，不是多份完整项目模板。共用 Git、规范、产品需求、契约与交付流程，保留独立依赖锁和运行环境。Web 与可选小程序是两个 JS 应用；当前没有共享运行时包，不为目录数量引入 workspace/构建平台。两客户端不互相导入 UI，两个 Python 服务不互相导入源码。小程序技术边界见 [技术基线](../engineering/miniprogram/architecture/technology-options.md)。

主题、认证、Run 协议属于模板；具体实体、页面、工作流、提示词、评估属于业务。只做 CRUD 的业务仅启动前后端；需要持久化任务执行时再接入 AI 服务。

## 工程规范的总分边界

规范组织与运行时架构分开：[公共代码质量](../engineering/common/code-quality.md) 定义命名、注释、复用与准确性；[公共 Python](../engineering/common/python.md) 只覆盖两服务的语言共性；[Web 前端](../engineering/frontend/README.md)、[小程序](../engineering/miniprogram/README.md)、[后端](../engineering/backend/README.md)、[AI](../engineering/ai-service/README.md) 分别拥有组件/状态、业务事务、持久执行的专项规则。

该划分不新增共享运行时包，不要求每个项目安装全部技术或实现所有目标能力。规则归属和冲突处理见 [文档地图](../README.md#规则归属)；各端公开类型、组件清单与当前能力仍以对应代码和事实源核对。

业务技术方案沿用本目录，按需维护 `<area>/overview.md`，复杂功能再补 `features/<feature>.md`；不预建空方案或复制系统基线。方案覆盖核心流程与适用的失败/重试/回滚路径，获批后由 change design 引用；具体分级与批准流程见 [交付流程](../engineering/workflow/delivery.md)。

- [智能衣柜技术方案](wardrobe/overview.md)：总体架构及账户与资料、衣柜管理、穿搭推荐、穿着记录与统计、天气集成分方案。采用微信身份、Backend 私有媒体、业务 Outbox 与单 Worker；天气默认杭州，使用中国天气网 HTTP 与上海自然日共享缓存。日期统一采用北京时间，推荐调整与异常恢复见对应分方案；实现边界见下文，真实接入与最终产品验收待完成。

## 数据流与所有权

业务推荐链路：微信客户端 → backend（用户/资源授权、业务请求与Outbox）→ 显式Dispatcher → AI API（受信服务身份）→ PostgreSQL-backed Command Queue → 单Worker → LangGraph → Backend最新事实复核与受控结果。

当前实际：Web 标准 AuthForm/LoginModal 继续通过 gateway 与代理消费用户名密码认证；小程序通过微信 code 登录并访问本人的私人衣柜/媒体、穿着历史/统计、个人资料、长期偏好与城市天气上下文。小程序按会话代次隔离请求、缓存及草稿，图片经 Backend 鉴权读取。代码和隔离集成检查不代表真实微信、媒体持久化或定位接入已验收。穿搭推荐由Backend冻结候选、偏好/历史/天气与revisions，通过Outbox及显式Dispatcher消费受信AI Run；客户端只访问本人业务请求。推荐与替换不写穿着，带来源的实际穿着保存同事务重验，历史及统计继续使用有效记录事实。

后端为同步 FastAPI → service → repository → model；API 装配鉴权依赖，service 拥有事务，repository 只 flush/query。core 只提供业务无关基础设施。Redis 缓存故障可回源，认证限流/撤销检查故障拒绝请求。

AI API 装配 `RunService(RunStore)`；application 依赖 core Protocol，不依赖 PostgreSQL 实现。Worker 通过 `bootstrap.create_runner` 注册并注入绑定 Saver 的 workflow；core 的 `WorkflowRunner` 仅分派注册 ID，不 import LangGraph。API 不执行 workflow。Run/命令同事务提交，事件与状态同事务提交；Checkpoint 独立提交，但与 Worker 排他锁、应用写入共享会话，连接丢失后停止推进。当前是单 Worker，不支持多 Worker 横向扩容。

PostgreSQL 同机分库分角色；应用表与 LangGraph 表分别迁移。Redis 不是 AI 队列。所有迁移显式执行，不在请求或应用启动中建表。

## 当前与目标

当前支持 `echo.v1` 与结构化 `wardrobe.recommend.v1`、静态注册与执行注入、配置校验、Bearer服务认证、受信scope、幂等冲突、持久命令/JSON事件、显式sync Checkpoint及输入/执行描述一致性保护、取消及终态不可覆写、Worker JSON日志、存活/就绪和包内离线自检。穿搭工作流使用prepare→invoke→validate与单Operation，先持久化准备和sending，再在事务外调用模型，完整原始响应存AI数据库后继续；sending无持久响应为unknown，不重发，已有响应可恢复复用。模型默认关闭；具体Responses adapter与真实供应商兼容性分开，真实调用仍待接入验证。包入口、实现位置与验证命令见 [AI README](../../ai-service/README.md)，依赖版本以各端 lockfile 为准。离线自检不证明 PostgreSQL 或生产环境就绪。

[Runtime 扩展设计](ai-service/agent-runtime-architecture.md) 和其中 ADR 是目标，不是完成清单。当前调用记录限定每Run最多一次模型请求，不是多attempt或金额预算平台。通用工具注册、金额预算、人工审批、客户端SSE事件、Artifact、生产多租户及多Worker fencing仍未实现；业务接入须复用已有调用恢复边界，不能把echo节点直接替换为付费调用。

Compose 仅本地使用开发凭证和 loopback 端口。公网部署另需 TLS、逐资源授权、配额、备份、观测与安全验收。启动命令只维护于 [根 README](../../README.md) 和各端 README。

开发工作流使用全局 Manager Skills 与项目 OpenSpec CLI，来源、版本与接入见 [工具入口](../engineering/workflow/tooling.md)。开发协作与运行时 Agent 服务的状态、模型和数据相互独立；开发侧角色分工不代表 ai-service 已接入模型调用。
