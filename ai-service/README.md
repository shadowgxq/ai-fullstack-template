# AI Service

通用 Agent Runtime，采用 Python/FastAPI + LangGraph + PostgreSQL 单 API/单 Worker。AI 执行不依赖 Redis/Celery；工程规范见 [AI 服务工程规范](../docs/engineering/ai-service/README.md)。

## 实现入口

| 内容 | 实现 |
|---|---|
| 包与命令 | `pyproject.toml`、`uv.lock`、`cli.py`、`__main__.py`；支持安装后运行 |
| API / 配置 | `api/app.py`、`api/schemas.py`、`config.py`；认证、scope、Pydantic、OpenAPI |
| 注册与注入 | `bootstrap.py` 将显式注册的 `echo.v1` 绑定到 `agent_core/runtime.py`；未注册版本不自动猜测或动态导入 |
| Worker / 恢复 | `worker.py` 注入同连接 PostgresSaver；`workflows/echo.py` 显式 sync durability、冻结输入校验和恢复 |
| 持久化 / 迁移 | `infrastructure/store.py`、版本化 SQL/checksum、独立 Saver setup |
| 日志 / 自检 | Worker JSON 日志；`diagnostics.py` 离线检查实际 workflow、schema 与包内 SQL 资源 |

`WorkflowRunner` 负责框架无关分派，workflow 调度由 LangGraph 负责。HTTP 字段、状态和错误语义见 [跨端契约](../docs/contracts/README.md)。

## 安装与离线自检

Python 3.12、uv。在 `ai-service/` 下执行：

```bash
uv sync --locked
uv run --locked ai-service check
# 等价的 Python module 入口
uv run --locked python -m ai_service check
```

安装需要获取锁定依赖；安装后 `check` 本身不读取真实凭证、不连接数据库或模型。输出中的 `postgresql: not_checked` 明确表示未验证数据库，不替代 `/ready`、integration 或全栈 smoke。无子命令只显示用法，不自动启动服务。

## 本地启动

先在根执行 `make infra`，然后在本目录：

```bash
cp .env.example .env
make migrate
make dev
# 第二个终端，仍在 ai-service/
make worker
```

安装包提供以下显式入口；自检不会隐式启动服务或执行迁移：

```bash
uv run --locked ai-service migrate
uv run --locked ai-service api --host 127.0.0.1 --port 8001
uv run --locked ai-service worker --once
```

也可使用 Makefile、Uvicorn 工厂和 `python -m ai_service.worker` 入口。API 在 8001；`/health` 是存活探针，`/ready` 检查应用表和 Checkpoint 表。迁移显式执行，不在 API import、启动或请求中自动建表。

```bash
curl -X POST http://127.0.0.1:8001/api/v1/runs \
  -H 'Authorization: Bearer local-ai-service-key-change-before-deploy' \
  -H 'Idempotency-Key: example-001' -H 'Content-Type: application/json' \
  -d '{"workflow":"echo.v1","input":{"text":"hello"}}'
```

使用返回 run_id 查询 `/api/v1/runs/{run_id}`、`/result`、`/events`，均需相同认证。环境变量为 `AI_DATABASE_URL`、`AI_API_KEY`、`AI_SCOPE`、`AI_POLL_INTERVAL`，格式和默认值见 [config.py](src/ai_service/config.py)；服务凭证不能放进 VITE 变量。

## 验证与限制

```bash
make check-offline
make check
# 显式配置专用测试数据库；名称必须以 _test 结尾。
AI_TEST_DATABASE_URL=postgresql://test:test@localhost:5432/ai_runtime_test uv run --locked pytest
```

未配置测试数据库时 integration 明确 skipped，不算 PostgreSQL 验证通过。CI 使用真实 PostgreSQL，覆盖失锁、重复创建、Checkpoint 恢复、独立 CLI Worker、未知版本拒绝和离线自检。构建后将 wheel 安装到测试环境，在源码目录外运行 module/console 自检，验证安装入口与迁移资源；不是仅验证 editable checkout。

根 `make check` 执行项目级检查；服务启动后 `make smoke` 验证独立 API/Worker 与后端认证。Worker 日志只允许明确上下文字段，不输出任意 extras/异常正文；日志消息本身仍须遵守安全规范，formatter 不是通用秘密扫描器。

当前仅提供确定性 `echo.v1`。真实模型、ModelPort/ToolRegistry、Operation Ledger/预算/unknown、人工回答、取消、修订、SSE、Artifact 审核发布与生产多租户尚未实现，见 [当前与目标](../docs/architecture/README.md)。接入有副作用的外部调用前须先实现对应的授权、预算和恢复边界。
