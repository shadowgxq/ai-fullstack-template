# AI Service 技术基线

本文维护工程选型及能力落地边界，不重写 [系统架构](../../../architecture/README.md) 或 [Runtime 目标设计](../../../architecture/ai-service/agent-runtime-architecture.md)。基线核对于 2026-09-20；实际版本以本仓库配置和 lockfile 为准，不照抄参考项目的候选版本。

## 当前采用的技术

| 领域 | 本仓库基线 | 事实源 |
|---|---|---|
| Python / 包管理 | Python 3.12 开发基线；单个 `ai_service` 包，uv 管理独立依赖与锁 | [.python-version](../../../../ai-service/.python-version)、[pyproject.toml](../../../../ai-service/pyproject.toml)、[uv.lock](../../../../ai-service/uv.lock) |
| API / 配置 | FastAPI、Pydantic DTO、pydantic-settings；Uvicorn 工厂入口 | [app.py](../../../../ai-service/src/ai_service/api/app.py)、[schemas.py](../../../../ai-service/src/ai_service/api/schemas.py)、[config.py](../../../../ai-service/src/ai_service/config.py) |
| 编排 | LangGraph `StateGraph`；当前只有确定性 `echo.v1` | [echo.py](../../../../ai-service/src/ai_service/workflows/echo.py) |
| 应用存储 | 同步 psycopg；PostgreSQL Run、Command Queue、事件表 | [store.py](../../../../ai-service/src/ai_service/infrastructure/store.py) |
| Checkpoint | `langgraph-checkpoint-postgres` 的同步 `PostgresSaver` | [worker.py](../../../../ai-service/src/ai_service/worker.py) |
| 应用迁移 | 版本化 SQL + checksum；Checkpoint 表另由 `saver.setup()` 管理 | [migrate.py](../../../../ai-service/src/ai_service/infrastructure/migrate.py) |
| 本地环境 | Docker Compose；PostgreSQL 16 镜像；API / Worker 同包、不同进程 | [Compose](../../../../compose.yml)、[AI Dockerfile](../../../../ai-service/Dockerfile) |
| 验证 | pytest、Ruff、HTTPX/TestClient；仓库级文档与架构检查 | [AI Makefile](../../../../ai-service/Makefile)、[CI](../../../../.github/workflows/verify.yml) |

API 的同步数据库路径使用普通 `def`。不能只把签名改成 `async def`，然后继续直接调用阻塞 I/O。若改用异步，需要一起验证驱动、Saver、资源生命周期、事务与失锁恢复，不只是换一个类名。

当前 AI 服务不采用后端的 SQLAlchemy/Alembic 作为自身持久化方案；Redis 虽存在于全栈环境，也不是 AI 任务队列。不要因参考项目使用这些技术就替换现有实现。

## 能力状态与启用条件

| 状态 | 能力 | 实现约束 |
|---|---|---|
| 已有实现 | 服务认证、受信 scope、创建幂等、JSON 事件轮询、单 Worker、Checkpoint 恢复 | 从现有代码和对应测试扩展；测试存在不等于本次已运行 |
| 目标能力，尚未实现 | Operation Ledger、预算、`unknown`、ModelPort、ToolRegistry、Artifact Store | 按相关规范完成持久化、安全和回归后，才能接有副作用的外部调用 |
| 目标能力，尚未实现 | 人工回答、取消、修订、SSE、不可变审核发布 | 先定义契约及状态迁移；不能因为 LangGraph 支持就宣称 HTTP 服务已支持 |
| 按需扩展 | LangChain 模型适配、供应商 SDK、Langfuse、MCP、RAG、Planner、多 Agent、缓存/长期记忆 | 进入明确任务范围后选择依赖和实现，不作为初始化前置 |
| 另需架构决策 | 多 Worker、分机存储、异步栈、消息队列或 ORM 迁移 | 先更新 ADR、兼容方案与故障测试，不通过文档补充悄悄改选型 |

新增直接 import 的第三方包必须声明为直接依赖，不依赖 transitive dependency 偶然存在。依赖升级同步 lockfile；不在规范正文维护第二套补丁版本列表。当前没有项目级 mypy/pyright 检查，不虚构 `typecheck` 命令。

## 参考取舍

本轮仅参考 `company-lens` 提交 `e41624299139f80db513ed2dfe4a8fe0112fa233` 的 [架构第 3–4 节](https://github.com/shadowgxq/company-lens/blob/e41624299139f80db513ed2dfe4a8fe0112fa233/docs/architecture/ai-architecture.md) 与 [工程规范第 4–7 节](https://github.com/shadowgxq/company-lens/blob/e41624299139f80db513ed2dfe4a8fe0112fa233/docs/engineering/ai-development-standard.md)，只吸收技术边界，不复制源码或业务模型。

采用其单包 API/Worker、LangGraph、Pydantic 边界校验、受控外部调用、版本化资源和分层验证思路。其 AsyncPostgresSaver、SQLAlchemy/Alembic、PostgreSQL 17 候选方案、独立持锁连接设计不覆盖本仓库的同步栈和同连接保护约束；其双应用结构与任务目录也不替代当前三端架构和 Manager/OpenSpec。

不迁入其 PRD、需求编号、公司/证券实体、计算公式、研究模式、报告结构或质量阈值。参考仓库是设计来源，不是本模板的运行依赖，也不是能力已落地的证据。
