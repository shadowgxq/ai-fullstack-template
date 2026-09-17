# AI Service

通用 Agent Runtime 的可运行初始化，不是完整研究产品。沿用当前文档的 Python/FastAPI + LangGraph + PostgreSQL 单 API/单 Worker 方案，不新增 Redis/Celery 前置依赖。

## 本地启动

Python 3.12、uv、PostgreSQL。在根执行 `make infra`，然后在本目录：

```bash
uv sync --locked
cp .env.example .env
make migrate
make dev
# 第二个终端，仍在 ai-service/
make worker
```

API 在 8001，`/health` 是存活探针，`/ready` 检查应用表与 checkpoint 表。迁移包含带 checksum 的应用 SQL 和独立 saver setup；不会在 API 启动/请求中自动执行。

```bash
curl -X POST http://127.0.0.1:8001/api/v1/runs \
  -H 'Authorization: Bearer local-ai-service-key-change-before-deploy' \
  -H 'Idempotency-Key: example-001' -H 'Content-Type: application/json' \
  -d '{"workflow":"echo.v1","input":{"text":"hello"}}'
```

使用返回 run_id 查询 `/api/v1/runs/{run_id}`、`/result`、`/events`，均需相同认证。

环境变量：`AI_DATABASE_URL` 为 psycopg PostgreSQL URL；`AI_API_KEY` 至少 24 字符；`AI_SCOPE` 默认 local，来自受信配置而不是请求；`AI_POLL_INTERVAL` 默认 0.5 秒。服务 token 不能写入 VITE 变量。

## 验证与限制

```bash
make check
# 显式配置专用测试数据库；名称必须以 _test 结尾。
AI_TEST_DATABASE_URL=postgresql://test:test@localhost:5432/ai_runtime_test uv run pytest
uv run python -m ai_service.worker --once
```

未配置测试数据库时 integration 明确 skipped；不能把这称为 PostgreSQL 验证通过。根 CI 配置真实数据库并运行 integration，`make smoke` 验证独立 API/Worker 进程和后端认证。

当前仅注册 `echo.v1`，无付费模型、外部工具和远端副作用。已具备 scope/key 幂等、持久命令和事件、LangGraph checkpoint 重放与单 Worker 排他锁；不支持多 Worker 扩容。完整台账/预算/unknown、人工回答、取消、修订、SSE、Artifact 审核发布与生产多租户仍是 [目标架构](../docs/architecture/ai-service/agent-runtime-architecture.md)。不要直接将 echo 节点改为付费调用。
