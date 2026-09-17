# ADR-0001：单仓库与前端复用

> 状态：单仓库和前端复用已确认；后端依赖组合与部署细节 proposed。

## 背景

项目需要把长时研究、证据与报告呈现接成一条可恢复链路。已有前端样式、组件和交互可复用；新 AI 服务有独立的 Run、事件和可信研究合同。

## 决定

- 使用 `frontend/` + `ai-service/` 两个应用工程；API 与 Worker 来自同一 `ai_service` 包，core/research 为内部模块。
- 保留现有 React/TypeScript/Vite、CSS Modules、Radix UI、主题和 i18n；接口按新服务合同接入，不兼容旧 tasks/research-projects API。
- 后端按现有设计采用 FastAPI/Pydantic、LangGraph 固定图、PostgreSQL 应用表与 Saver；兼容依赖版本在初始化时验证。
- 首期使用单 Worker 和数据库持久命令，不提前引入独立消息中间件、动态 Planner 或向量平台。

## 原因与代价

复用前端降低重复建设，单包减少发布和契约维护面；代价是需要替换前端旧 API/DTO/事件层，并处理已有页面状态与新合同的对应关系。

单 Worker 简化领取与恢复，但不提供分布式接管或弹性扩容。受控本地内容目录要求 API 与 Worker 可访问同一持久存储；跨主机部署时需单独选择共享存储方案。

## 演进条件

出现第二个真实业务、持续的吞吐瓶颈或跨主机需求时再评估拆包、队列、多 Worker 与对象存储。重要变化新增 ADR 并注明替代关系。供应商、认证、费用阈值和部署方案仍待对应任务决定。
