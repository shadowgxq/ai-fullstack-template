# 初始化验证证据

日期：2026-09-17。已验证运行时提交：`1d39defc75cd9aee6159d552653cc5e1366236a5`。

[完整 CI 运行](https://github.com/shadowgxq/ai-fullstack-template/actions/runs/35212218702) 的 docs、frontend、backend、ai-service、stack 五个 job 全部 success。后续收尾只对齐后端本地 Python 版本选择、精简旧规范与补充本文；最终提交的复验结果以 PR Checks 为准。

| 需求 | 实际验证 | 结果 |
|---|---|---|
| REQ-DOC-001 | `make docs`：Markdown 导航、AGENTS 长度、Manager/repairs、需求引用；校验器 3 项回归 | 通过 |
| REQ-MONO-001 | 前端 frozen install、typecheck、严格 lint、8 项单测、格式、build、Vite preview HTTP | 通过 |
| REQ-MONO-001 | 后端 frozen install、ruff check/format check、20 项测试、OpenAPI 漂移 | 通过 |
| REQ-AI-001 | AI frozen install、ruff、15 项 unit + 5 项真实 PostgreSQL integration、sdist/wheel、OpenAPI 漂移 | 20 项通过，无 skipped |
| REQ-MONO-001 / REQ-AI-001 | 干净 runner 中 `docker compose up --build -d --wait --wait-timeout 180` 与 `python3 scripts/smoke.py` | 通过 |

整栈 smoke 实际覆盖前端 HTML/构建资源、Nginx API 代理、两端健康/依赖就绪、PostgreSQL 注册登录、Redis 撤销 token，以及受信 AI API→持久命令→独立 Worker→LangGraph→结果/事件。集成测试另外覆盖 scope 隔离、并发幂等、不同请求键冲突、checkpoint 后发布前中断恢复、第二 Worker 排他和结果不可覆写。

根 AGENTS 为 23 行，各端 AGENTS 为 8 行；专项规则不塞进入口。历史记账材料保存在 examples，不参与当前需求执行。代码契约快照由各服务真实 OpenAPI 导出并通过漂移检查。

未执行：真实模型/付费工具、浏览器视觉与人工交互验收、Windows 原生环境、负载/生产安全测试。后端单测的 SQLite/FakeRedis 不被描述为真实依赖验证；真实依赖证据来自 Compose job。依赖与 Actions 的弃用警告保留可见，未通过关闭检查掩盖。
