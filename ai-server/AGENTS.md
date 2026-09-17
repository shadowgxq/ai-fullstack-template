# AI Server 项目导航

本目录只维护通用 AI Agent Runtime 架构。开始相关任务时，先阅读 [文档入口](docs/README.md)，再按需读取主架构或 ADR。

通用层负责 Run、执行、恢复、调用台账、预算、产物、事件和权限边界。产品业务实体、业务工作流、提示词、工具策略和评估样本由使用方项目维护，不写回本目录的通用架构。

新增实现时保持一个 Python 包内的 `api`、`application`、`agent_core`、`workflows` 和 `infrastructure` 边界；只有真实复用或部署需求出现后，才拆分独立包或服务。
