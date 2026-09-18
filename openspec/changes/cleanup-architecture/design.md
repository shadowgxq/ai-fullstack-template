# 设计决策

遵循 [实际架构](../../../docs/architecture/README.md) 与 [接口事实源](../../../docs/contracts/README.md)。

| 决策 | 理由与边界 |
|---|---|
| 删除历史业务，Git 保留追溯 | 不再移动到新的 examples 目录污染上下文；保留当前待评审需求 |
| 根 `.agents/skills` 单源 | AGENTS 保持导航；本机模型、权限设置不成为项目规范 |
| 已合并 change 归档并同步基线 | `manager/plan.yaml` 只索引阶段；tasks 维护唯一细项进度 |
| YAML 用标准解析器 | 独立工具环境固定 PyYAML 6.0.3，不在校验器中手写 YAML 解析、不依赖服务虚拟环境 |
| 事务只由 service 提交 | Repository flush 可供组合事务回滚；并发唯一冲突 rollback 后归一化 |
| 鉴权装配归 API 层 | core 不依赖业务；AI application 依赖 RunStore Protocol，而非 psycopg 实现 |
| Redis 按风险分开 | 缓存降级，限流/撤销失败拒绝，登出写入失败不返回成功；MULTI + EXPIRE NX 保证固定窗口写入 |
| JWT/字段错误公开契约 | JSON 登录使用 HTTP Bearer；校验 sub/jti/exp、UTF-8 密码长度；422 仅返回 loc/type/msg |
| 检查点与锁同连接 | 失去 PostgreSQL 会话同时丧失推进和检查点写权限；不声称跨系统 exactly-once |
| Web 可独立启动 | 按 Compose 依赖仅启动 frontend/backend；完整模式仍包含 AI 与 Worker，不为 CRUD 强制启动 Agent |

不更改表结构或已有迁移，不删除数据卷。HTTP 错误格式变更同步 OpenAPI、说明和前端直接消费者。AST 门禁仅验证静态导入/事务调用，语义和运行恢复仍依赖测试与人工审查。
