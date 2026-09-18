# Tasks — REQ-CLEAN-001

同一负责人串行修改共享计划、契约与验证脚本；保留 `docs/product/team-site.md` 原文，不修改业务数据库迁移。

- [x] 1. Repository owner：删除历史业务/重复工具入口，归档已合并 change 并同步规范；输入旧树与合并事实，验证目录扫描和导航。
- [x] 2. Backend owner：修正 API 装配、事务、Redis 策略、JWT/字段边界与错误脱敏；依赖 1，补负面行为测试。
- [x] 3. AI owner：RunStore 端口与同会话检查点；依赖 1，补真实 PostgreSQL 会话终止回归。
- [x] 4. Frontend owner：处理字段错误 data，保留旧 details 兼容；依赖 2，补直接消费者测试。
- [x] 5. Integration owner：锁文件与 OpenAPI 再生成，文档/结构门禁、三端检查、web-only 与完整 Docker 启动全部复验。
- [x] 6. Review owner：复核最终 diff、团队小站未改、临时工具已移除，记录真实结果并提交 PR。

验证入口：根 `make docs architecture contracts-check`，前端 `pnpm --dir frontend check`，服务 `make -C backend check` 与 `make -C ai-service check`，`make up-web smoke-web` 和 `make up smoke`。结果只记录于 verification；不得用上一份 PR 的通过代替本次验证。
