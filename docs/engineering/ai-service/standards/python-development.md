# AI 服务 Python 实现入口

AI 代码读取 [公共代码质量](../../common/code-quality.md)、[Python 公共写法](../../common/python.md) 与本页；公共内容已读不重复加载。本页只补 Agent Runtime 的执行、依赖和证据边界。

## 当前实现约束

- 当前 API/Worker 使用同步 psycopg 与 `PostgresSaver`，不复制 backend 的 SQLAlchemy Repository 模式。普通同步 helper 不会自动卸载阻塞操作，通用并发规则见公共 Python 文档。
- `api/app.py:create_app` 装配 Store 后注入 `RunService`；application/agent_core 保持框架无关。具体允许依赖与 composition 例外见 [分层](layer-and-file-organization.md)。
- 复用 `agent_core/contracts.py` 的身份/错误、`ports.py` 的 RunStore、`runtime.py` 的注册分派和 `bootstrap.create_runner`；接入 workflow 不再创建平行 Runner、Run 模型或连接入口。
- HTTP DTO、Graph State、持久化 row 与公开结果按边界区分；新增类型不能只声明 TypedDict 后省略外部校验。数据库读取/恢复也是信任边界，需核对冻结输入和版本，不把历史 Checkpoint 当成永远可信的内部对象。
- 当前 Worker 的锁、应用写入与 Checkpointer 共用会话；这不是同一事务，也不代表查询并行。恢复和失锁处理只由 [Checkpoint 规范](checkpoint-and-effects.md) 定义，不能按通用连接池建议另建 Saver 连接。

## Node、错误与外部能力

Node 的读写字段、退出条件和重放语义见 [Workflow 与 State](workflow-and-state.md)；复杂规则与 I/O 分离，小 Node 不要求额外 class 或逐个说明文件。

输入错误、资源冲突、持久化失败、供应商失败与业务资料缺失要区分；普通异常、interrupt 和取消控制信号不能互相吞掉或伪装成功。错误类型与 HTTP 映射见 [API 规范](api-events-and-artifacts.md)。

外部 SDK 只在 adapter，模型/工具的授权、次数与恢复见 [受控调用规范](model-and-tools.md)。该页的 ModelPort/ToolRegistry/Operation Ledger 是扩展设计，不能当成已存在模块直接 import。schema 合法与生成内容正确分开验证，不以模型自评代替可复算规则或来源证据。

## 验证

根据 [测试与 Evals](../testing/testing-and-evals.md) 选择相邻测试、真实 PostgreSQL、安装包或 recorded/live 证据；不把离线 echo 与类型检查当作通用 Agent 正确性证明。命令仍以 [AI README](../../../../ai-service/README.md) 与 Makefile 为准，未授权不启动 live 调用。
