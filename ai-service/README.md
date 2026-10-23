# AI Service

通用 Agent Runtime，采用 Python/FastAPI + LangGraph + PostgreSQL 单 API/单 Worker。AI 执行不依赖 Redis/Celery；工程规范见 [AI 服务工程规范](../docs/engineering/ai-service/README.md)。

## 实现入口

| 内容 | 实现 |
|---|---|
| 包与命令 | `pyproject.toml`、`uv.lock`、`cli.py`、`__main__.py`；支持安装后运行 |
| API / 配置 | `api/app.py`、`api/schemas.py`、`config.py`；认证、scope、Pydantic、OpenAPI |
| 注册与注入 | `bootstrap.py` 显式注册 `echo.v1`、`wardrobe.recommend.v1`；未注册版本不自动猜测或动态导入 |
| Worker / 恢复 | `worker.py` 注入同连接 PostgresSaver、Operation Store 与 ModelPort；两个 workflow 均使用 sync durability |
| 模型边界 | `infrastructure/model_adapter.py` 实现受信地址的 OpenAI Responses JSON/SSE 协议；prompt/schema 为包内版本化资源 |
| 持久化 / 迁移 | `infrastructure/store.py`、追加 SQL/checksum、独立 Saver setup；Run、Command、Event、Operation 分别持久化 |
| 日志 / 自检 | Worker JSON 日志；`diagnostics.py` 离线检查注册、schema、prompt 与包内 SQL 资源 |

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

使用返回 run_id 查询 `/api/v1/runs/{run_id}`、`/result`、`/events`，或 POST `/api/v1/runs/{run_id}/cancel`，均需相同认证及服务端 scope。重复取消返回当前状态；取消不撤回已经发送的 HTTP 请求，也不保证免除该次费用。环境变量格式和默认值见 [.env.example](.env.example) 与 [config.py](src/ai_service/config.py)；服务凭证不能放进 VITE 变量。

## 衣橱推荐执行

`wardrobe.recommend.v1` 接收有界结构化候选、偏好、历史、天气事实、版本及事实引用；自由文本只作为输入数据，不能改变系统指令。结构化输出仅允许候选 ID、原因码、取舍码和已有事实引用。服务校验输出成员关系，不修补模型输出，也不追加模型调用。Backend 负责候选硬过滤、事实真实性和最终发布校验；舒适度文本仅供参考，不能宣称保证满足。

模型默认禁用。启用需显式配置 `AI_MODEL_ENABLED=true`、`AI_MODEL_NAME`、`AI_MODEL_API_KEY`；超时、响应大小和输出 token 上限分别由 `AI_MODEL_TIMEOUT_SECONDS`、`AI_MODEL_MAX_RESPONSE_BYTES`、`AI_MODEL_MAX_OUTPUT_TOKENS` 限定。未配置时请求可持久化为 Run，Worker 以 `model_not_configured` 结束且零发送。协议使用 [OpenAI Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) 的 `text.format` 严格 JSON Schema。`AI_MODEL_BASE_URL` 默认 `https://api.openai.com/v1`，只接受运维配置的http/https origin加`/v1`，不能含凭据、query或fragment；不接受业务请求指定地址。`AI_MODEL_RESPONSE_TRANSPORT` 显式选择 `responses-json.v1` 或 `responses-sse.v1`，不自动fallback、探测、重试或redirect。可选 `AI_MODEL_REASONING_EFFORT` 写入新Run的冻结请求，未配置时不发送。SSE只采用终态事件中的完整response，保留本次捕获的原始事件和已知usage，截断且没有终态时为unknown，不使用文本delta拼造成功。

配置优先级为进程环境、当前工作目录`.env`、项目根`.env`；在`ai-service/`原生运行与根Compose均可消费根模型配置，端内`.env`仅作为显式覆盖。供应商Key仅AI进程读取。执行描述冻结地址与传输，不含Key；当前配置地址与未执行旧Run的冻结地址不一致时拒绝发送当前Key，已持久响应仍可跨配置恢复。旧执行描述缺少新增字段时保持原JSON/无reasoning协议。具体网关的严格输出与usage兼容性需要真实接入证据。

每个 Run 冻结不含凭据的执行描述，包括模型、参数和包内资源 hash。基础prompt.v1保持原文件；新Run追加独立版本`wardrobe.reason-evidence.v1`说明各理由码的事实条件，冻结其版本和hash。旧描述没有该字段时保持原请求字节，不把新说明套入旧Checkpoint。prepare Checkpoint 同步持久化后才创建唯一的 `sending` Operation 并发送一次；完整响应先持久化，再进入本地校验。恢复时重用已持久响应；若只有 `sending` 而无持久响应，则标记 `unknown` 并以 `call_outcome_unknown` 结束，不再次发送。Worker 的 Store、Saver、Operation 共用持锁连接，连接丢失即停止，不能重新连接后补写。取消和完成通过数据库事务竞争终态；迟到响应可保留调用证据，不能覆盖已取消状态。原始响应、请求体、执行描述和服务端 scope 不进入公开 Run DTO。

远端创建响应丢失而不知道run_id时，受信服务可向 `POST /api/v1/runs/cancel-by-key` 提交原创建body和同一Idempotency-Key。接口原子取消已有Run，或直接记录cancelled Run而不写执行命令；之后create同key重放返回已取消状态。不能为取消而先创建一个可能启动模型的新Run。

## 验证与限制

```bash
make check-offline
make check
# 显式配置专用测试数据库；名称必须以 _test 结尾。
AI_TEST_DATABASE_URL=postgresql://test:test@localhost:5432/ai_runtime_test uv run --locked pytest
```

未配置测试数据库时 integration 明确 skipped，不算 PostgreSQL 验证通过。测试使用独立 schema，覆盖真实 PostgreSQL/Saver、同步 prepare、发送边界故障、持久响应复用、独立 CLI 恢复、失锁、取消竞争及旧 echo Checkpoint 升级。模型 HTTP 使用边界替身，不代表真实模型、费用或兼容性验收。源码目录外的 module/console 自检用于核对实际安装入口与包内资源；editable 安装检查与 wheel 安装检查须分别报告。

根 `make check` 执行项目级检查；服务启动后 `make smoke` 验证独立 API/Worker 与后端认证。Worker 日志只允许明确上下文字段，不输出任意 extras/异常正文；日志消息本身仍须遵守安全规范，formatter 不是通用秘密扫描器。

当前提供确定性 `echo.v1` 和上述受限推荐执行链。ToolRegistry、通用预算平台、人工回答、修订、面向客户端的SSE事件接口、Artifact 审核发布与生产多租户尚未实现，见 [当前与目标](../docs/architecture/README.md)。
