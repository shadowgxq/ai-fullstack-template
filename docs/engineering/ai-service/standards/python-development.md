# Python 开发规则

AI 服务实现先读本页；模块职责见 [分层与文件组织](layer-and-file-organization.md)，配置安全和验证原则复用 [公共工程细则](../../common/README.md)。

## 类型与边界

- 新增或修改的公共函数、Protocol、Node 输入输出写类型注解；明确返回类型，避免跨模块传递无约束 `dict` / `Any`。
- HTTP、配置、工具参数和模型解析结果在入口使用 Pydantic 校验；内部纯数据优先 TypedDict、dataclass 或小类型。TypedDict 不提供运行时验证。
- 对需要拒绝隐式转换的字段使用严格类型或 strict 配置；不要全局机械开启 strict 后破坏 UUID、日期等既有 JSON/HTTP 输入。未知字段策略、长度、枚举和空值语义随契约测试确认。
- 使用 `model_validate` / `model_dump` 等与锁定 Pydantic 版本匹配的 API；默认值不得掩盖缺失数据。嵌套可变默认值使用 factory。
- 协议时间使用带时区值；费用计算使用 Decimal 等可控精度表示，边界序列化格式由对应 schema 定义，不在 Node 随意转换为 float。

Pydantic 的严格校验行为见 [官方 strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/)。它证明形状和约束，不证明模型输出事实正确。

## 同步、并发与生命周期

当前 API 和 Worker 使用同步 psycopg / PostgresSaver；保留与现有执行模型一致的函数边界。FastAPI 普通 `def` handler 的线程池行为不等于任何普通 helper 都会自动卸载阻塞调用；异步路径的阻塞 I/O 必须显式处理，见 [FastAPI 并发说明](https://fastapi.tiangolo.com/async/)。

配置、客户端与可替换依赖从工厂或 Worker 入口注入。新增共享 client/pool 时，在进程生命周期中创建和关闭；FastAPI 可用 [lifespan](https://fastapi.tiangolo.com/advanced/events/)。导入模块、生成 schema、单元测试不得隐式连接数据库或模型；生命周期不代替显式迁移命令。

并行任务不得共享有可变事务状态的 session 或 cursor。psycopg 连接可被线程协调使用，但同连接事务共享、查询串行；不据此承诺数据库并行，见 [psycopg 并发说明](https://www.psycopg.org/psycopg3/docs/advanced/async.html)。当前 Worker 的特殊同连接保护按 [恢复规范](checkpoint-and-effects.md) 执行，不因这条一般规则拆出独立 Saver 连接。

不得跨进程复用连接。CPU 密集解析、长时间文件处理与网络并发都需要有界队列、超时和退出路径；出现真实需求后再选择线程/进程/异步实现，不预建运行平台。

## 错误与可测试性

纯计算、解析、格式转换与 I/O 分开；可替换依赖通过小 Protocol 注入，不让纯规则读取环境变量或网络。不要为一行函数机械增加 class。

区分输入错误、权限拒绝、状态冲突、解析失败、供应商失败、持久化失败和程序异常。只在能处理的边界捕获预期异常；`except Exception` 不得返回成功、空结果或伪造降级数据。框架 interrupt 和取消信号按各自控制流传播，不能被普通错误重试吞掉。

代码边界需要上下文时使用异常链，外部响应仍返回安全错误；原始异常正文和敏感输入不进入公开 DTO。重试与 unknown 规则只由 [受控调用规范](model-and-tools.md) 和 [恢复规范](checkpoint-and-effects.md) 定义，不在每个 helper 各写三次重试。

已有 Ruff 配置是静态检查与格式规则的事实源；不增加与本次实现无关的格式化、忽略项或类型检查器。根据 [测试与 Evals](../testing/testing-and-evals.md) 执行相邻验证，不以覆盖率为目的测试纯常量和转发函数。
