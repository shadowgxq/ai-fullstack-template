# Tasks

- [x] AI owner：在 `ai-service/src/ai_service/` 与 pyproject/Makefile 完成注册分派、注入、显式入口、日志和恢复保护；依赖当前架构与契约。证据：实现已提交到原 PR #5；本地 `test_runtime.py` 5 项通过。
- [x] Docs owner：同步 AI README、技术基线、分层、恢复、日志与测试规范，以及根架构的当前能力描述；不改产品需求。证据：本 change 所在提交包含对应文档，能力状态明确区分已有与扩展。
- [ ] Verification owner：验证 `ai-service/tests/`、现有全栈检查和安装 wheel；依赖上述实现。执行 CI 的 `make docs architecture`、各端 check、真实 PostgreSQL pytest、wheel 自检与 stack smoke；实际结果记录在 verification.md，不以旧提交结果替代新代码验证。
