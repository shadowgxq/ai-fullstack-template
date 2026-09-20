# 分层与文件组织

适用于 AI 服务代码与模块调整。公共跨服务约束见 [根规则](../../../../AGENTS.md)；本页只定义 `ai-service` 内部职责。

## 模块职责

| 位置 | 负责 | 不放入 |
|---|---|---|
| `api/` | 路由、认证依赖、公开 DTO、错误映射；工厂入口装配应用服务 | Workflow 执行、业务计算、直接修改 Checkpoint |
| `application/` | Run 命令/查询、应用流程、调用 core Protocol | FastAPI、psycopg、LangGraph、具体 Store 或 workflow import |
| `agent_core/` | 业务中性的类型、错误、纯规则与小 Protocol | HTTP、数据库驱动、供应商 SDK、LangGraph、具体产品逻辑 |
| `workflows/` | StateGraph 装配、Node、routing、工作流输入输出映射 | 自建持久任务队列、供应商直连、重复实现预算/幂等 |
| `infrastructure/` | PostgreSQL Store、迁移及按需新增的模型/工具/存储适配 | 产品流程决策、擅自扩大权限或重试 |
| `worker.py` | 领取命令、持锁、注入 Saver、选择受信 workflow、推进执行 | 第二套业务调度状态机 |
| `config.py` | 环境配置解析与验证 | 在 import 时连接外部服务 |
| `resources/`（扩展时） | 版本化 prompt、policy、workflow 配置 | 密钥、任意可执行脚本、未审核的远端动态配置 |

当前 `api/app.py:create_app` 是 API 的 composition root，可以 import 具体 Store 再注入 `RunService`；这不是允许所有 API handler 绕过 application。当前短事务由 Store 操作封装，不机械套用 backend 的 Repository 禁止 commit 规则；application 通过 Protocol 定义所需原子操作。

## 依赖与装配

常规依赖是 `api → application → agent_core`；workflow 使用 core 契约，infrastructure 实现这些契约。`worker.py` 与 API 工厂负责连接具体实现。

[现有架构检查](../../../../scripts/check_architecture.py) 明确禁止 `agent_core`、`application` import LangGraph、FastAPI、psycopg 和外围模块。需要 Runner 抽象时，core 保存框架无关 Protocol；LangGraph 调用放在 workflow/Worker 或合适的外围适配中，不能把 `CompiledStateGraph` 类型偷偷引入 core。

依赖接口按当前使用者定义，不预建万能 BaseAgent、BaseService、插件平台或 service locator。静态注册只接受服务端配置中的已知 ID，不从用户或工具文本动态 import Python callable。

## 文件落点

现有小型工作流继续使用 `workflows/echo.py`。复杂度真正增加后，按功能聚合，而不是为每个概念预建空文件：

```text
workflows/<workflow_name>/
  graph.py       # build/compile 与 routing
  state.py       # Graph State 与更新类型
  nodes.py       # 需要再拆分时才创建 nodes/ 子目录
  schemas.py     # 该 workflow 的输入输出类型
resources/<workflow_name>/  # 使用版本化资源时才创建
```

目录示意不是当前文件清单。公共 DTO 在 `api/schemas.py`，共享 core 类型在 `agent_core/contracts.py`，协议在 `agent_core/ports.py`；文件变大后再按职责拆分并更新引用。不在三个目录复制同名 Run 模型。

当前测试平铺在 `tests/test_unit.py`、`tests/test_postgres.py`。随实际用例增长可拆为 unit/integration/replay/evals；本次规范不要求移动现有文件。迁移仍在 `infrastructure/migrations/`。

命名使用 `snake_case.py`、`PascalCase` 类型，测试 `test_*.py`；避免含义不明的 `utils.py` 汇集层。新增 public interface 时同步直接调用者和 [相关测试](../testing/testing-and-evals.md)，不借目录调整改行为。
