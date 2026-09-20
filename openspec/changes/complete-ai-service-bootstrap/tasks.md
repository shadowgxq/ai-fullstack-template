# Tasks

- [x] AI owner：在 `ai-service/src/ai_service/` 与 pyproject/Makefile 完成注册分派、注入、显式入口、日志和恢复保护；依赖当前架构与契约。证据：原 PR #5 中的实际实现及 CI，见 [verification.md](verification.md)。
- [x] Docs owner：同步 AI README、技术基线、分层、恢复、日志与测试规范，以及根架构的当前能力描述；不改产品需求。证据：提交 `fc01ccb7` 包含对应文档并通过文档检查，明确区分已有与扩展能力。
- [x] Verification owner：验证 `ai-service/tests/`、现有全栈检查和安装 wheel；依赖上述实现。证据：提交 `fc01ccb7` 的 CI 五项 job 全部成功，AI 36 项测试包含 8 项真实 PostgreSQL 用例；具体命令、限制与迭代失败记录见 [verification.md](verification.md)。
