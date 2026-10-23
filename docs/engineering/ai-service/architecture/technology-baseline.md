# AI Service 技术基线

本文维护工程选型及能力落地边界；系统职责和扩展设计分别见 [系统架构](../../../architecture/README.md) 与 [Runtime 目标设计](../../../architecture/ai-service/agent-runtime-architecture.md)。实际版本以本仓库配置和 lockfile 为准。

## 当前采用的技术

| 领域 | 本仓库基线 | 事实源 |
|---|---|---|
| Python / 包管理 | Python 3.12 开发基线；单个 `ai_service` 包，uv 管理独立依赖与锁 | [.python-version](../../../../ai-service/.python-version)、[pyproject.toml](../../../../ai-service/pyproject.toml)、[uv.lock](../../../../ai-service/uv.lock) |
| 包入口 / 离线自检 | `ai-service` console script 与 module 入口；显式 api/worker/migrate/check | [cli.py](../../../../ai-service/src/ai_service/cli.py)、[diagnostics.py](../../../../ai-service/src/ai_service/diagnostics.py) |
| API / 配置 | FastAPI、Pydantic DTO、pydantic-settings；Uvicorn 工厂入口 | [app.py](../../../../ai-service/src/ai_service/api/app.py)、[schemas.py](../../../../ai-service/src/ai_service/api/schemas.py)、[config.py](../../../../ai-service/src/ai_service/config.py) |
| 注册 / 执行注入 | 框架无关 WorkflowRunner + 显式静态注册；开放 `echo.v1` 与 `wardrobe.recommend.v1` | [runtime.py](../../../../ai-service/src/ai_service/agent_core/runtime.py)、[bootstrap.py](../../../../ai-service/src/ai_service/bootstrap.py) |
| 编排 | LangGraph `StateGraph`；确定性echo与穿搭prepare/invoke/validate，开始/恢复使用显式sync durability | [echo.py](../../../../ai-service/src/ai_service/workflows/echo.py) |
| 应用存储 | 同步 psycopg；PostgreSQL Run、Command Queue、事件及单Operation响应证据 | [store.py](../../../../ai-service/src/ai_service/infrastructure/store.py) |
| Checkpoint | 同步 `PostgresSaver`；与 Worker 锁和应用写入共享同一连接 | [worker.py](../../../../ai-service/src/ai_service/worker.py) |
| 应用迁移 | 版本化 SQL + checksum；Checkpoint 表另由 `saver.setup()` 管理 | [migrate.py](../../../../ai-service/src/ai_service/infrastructure/migrate.py) |
| 本地环境 | Docker Compose；PostgreSQL 16；API / Worker 同包、不同进程 | [Compose](../../../../compose.yml)、[AI Dockerfile](../../../../ai-service/Dockerfile) |
| 日志 | Worker JSON formatter 与上下文字段 allowlist；未接远端 tracing | [logging.py](../../../../ai-service/src/ai_service/infrastructure/logging.py) |
| 验证 | pytest、Ruff、HTTPX/TestClient；真实 PostgreSQL、独立 CLI 进程、安装 wheel 后自检与仓库级检查 | [AI Makefile](../../../../ai-service/Makefile)、[CI](../../../../.github/workflows/verify.yml) |

API 的同步数据库路径使用普通 `def`；`async def` 路径不得直接执行阻塞 I/O。改用异步须一起验证驱动、Saver、资源生命周期、事务与失锁恢复。

AI 服务使用同步 psycopg 和版本化 SQL，不采用 backend 的 SQLAlchemy/Alembic；全栈环境中的 Redis 不是 AI 任务队列。持久化选型变更需经过 ADR 与兼容性验证。

## 能力状态与启用条件

| 状态 | 能力 | 实现约束 |
|---|---|---|
| 已有实现 | 包入口、静态注册与注入、服务认证、受信 scope、创建幂等、JSON事件轮询、单Worker、Checkpoint恢复、取消、单Operation调用恢复与Worker JSON日志 | 扩展现有代码和测试；离线自检不等于数据库就绪，验证结论须有实际执行证据 |
| 已有实现，真实模型待接入 | 框架无关ModelPort、显式OpenAI Responses adapter、每Run最多一次请求、持久原始响应及unknown恢复 | 模型默认关闭；冻结模型/参数/资源版本，禁止隐式重试或修复；替身验证不等于真实兼容性/usage验证 |
| 目标能力，尚未实现 | 多attempt及金额预算平台、ToolRegistry、Artifact Store | 按实际需求补齐权限、持久化和回归，不以一次请求额度冒充金额上限 |
| 目标能力，尚未实现 | 人工回答、修订、SSE、不可变审核发布 | 先定义契约及状态迁移；框架支持不等于 HTTP 服务已接入 |
| 按需扩展 | LangChain 模型适配、供应商 SDK、Langfuse、MCP、RAG、Planner、多 Agent、缓存/长期记忆 | 按实际需求选择依赖和实现，不作为初始化前置 |
| 另需架构决策 | 多 Worker、分机存储、异步栈、消息队列或 ORM 迁移 | 更新 ADR、兼容方案与故障测试 |

`WorkflowRunner` 只负责注册分派，不包含长期执行或外部副作用管理。安装与验证入口见 [AI README](../../../../ai-service/README.md)。

新增直接 import 的第三方包必须声明为直接依赖，不依赖 transitive dependency 偶然存在。依赖升级同步 lockfile；规范正文不维护第二套补丁版本列表。当前没有项目级 mypy/pyright 检查或 `typecheck` 命令。

## 技术参考

[参考架构第 3–4 节](https://github.com/shadowgxq/company-lens/blob/e41624299139f80db513ed2dfe4a8fe0112fa233/docs/architecture/ai-architecture.md) 与 [工程方式第 4–7 节](https://github.com/shadowgxq/company-lens/blob/e41624299139f80db513ed2dfe4a8fe0112fa233/docs/engineering/ai-development-standard.md) 提供单包 API/Worker、受控调用和分层验证的设计参考。来源固定到提交版本，仅用于追溯，不是运行依赖；本仓库的三端结构、同步栈和同连接保护以以上基线为准。
