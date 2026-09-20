# AI Service 初始化同步

关联既有 [REQ-AI-001](../../../docs/product/bootstrap.md)，承接用户在 PR #5 中要求“工程规范与实际项目初始化同步，并完成项目验证”的指令。

范围：在现有同步 FastAPI/psycopg/PostgresSaver 基座上增加显式包入口、静态 workflow 注册与执行注入、离线安装自检、Checkpoint 持久化与输入保护、Worker JSON 日志及对应回归。直接消费者是现有 API/Worker、CLI 与 smoke 客户端。

不改变 API/DTO/数据库/schema、依赖版本、前后端功能或架构选型。不迁入参考项目的产品需求，不实现付费模型、完整副作用引擎、审批、SSE、多 Worker 或生产部署。

任务与证据只在本 change 维护，根 Manager 只索引；继续更新原 PR #5，不建立第二份 repair 状态，也不自动归档或合并。
