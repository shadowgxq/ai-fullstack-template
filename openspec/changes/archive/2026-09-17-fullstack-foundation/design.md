# 设计

边界与已实现范围以 [架构](../../../../docs/architecture/README.md) 为准；公开 DTO 与幂等语义以 [契约](../../../../docs/contracts/README.md) 为准，不复制。

采用三个独立应用、一个根 Compose/CI 和 docs；沿用各端锁文件。AI 使用 PostgreSQL 命令箱、独立单 Worker、LangGraph PostgreSQL checkpoint、确定性 echo。应用迁移与 saver setup 显式执行。

验证包括文档/台账、三端静态测试、schema 漂移、真实 PostgreSQL 恢复/锁、Docker HTTP 闭环。目录重构通过 Git rename 追踪，历史业务输入移动 examples；没有运行数据迁移，不删除已有开发数据卷。
