# Workflow 与 State

适用于 LangGraph workflow 实现；外部调用需同时满足 [模型与工具](model-and-tools.md) 及 [Checkpoint 与副作用](checkpoint-and-effects.md)。

## 当前实现与扩展边界

[echo.py](../../../../ai-service/src/ai_service/workflows/echo.py) 展示 `StateGraph`、`START/END`、TypedDict、注入 Checkpointer，以及开始/恢复/读取已完成结果的分工。它是确定性示例，不是可直接替换为付费模型的 Node 模板。

先用固定 workflow 表达已知步骤。只有步骤需要动态生成时才启用 Planner；只有独立上下文、权限或验证责任确有价值时才拆多 Agent。调度仍由 LangGraph 负责，不在 Runner 中平行维护第二份业务循环。

## Node 与 routing

每个 Node 应能说明：读取哪些字段、写入哪些字段、是否有副作用、错误类别、能否重放以及退出条件。小 Node 用类型和简短 docstring 表达即可，不强制每个 Node 新建说明文件。

- Node 返回 State 的局部更新，不原地修改共享 State 或嵌套容器；纯转换与外部调用分离。
- graph builder 只负责装配和 compile，不执行网络请求。`add_node` / edge / 条件路由与 Node 处理逻辑分开。
- 单一 routing 决策使用明确的静态 edge、conditional edge 或 `Command`；不要同时配置本应互斥的 static edge 与 `Command(goto=...)`，造成两条路径都执行。
- 循环有显式业务结束条件和次数/时间上限；`recursion_limit` 是额外保护，不代表 token 或费用预算。
- 完成由代码校验输出与完成条件；图到达 END 或返回最后一段文本，不自动代表可对外发布。

这些 API 的精确行为以锁定版本和 [官方 Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api) 为准，不直接采用最新文档中的未验证新接口。

## State 的归属

| 数据 | 放置方式 |
|---|---|
| Node 需要的可恢复小状态 | TypedDict 等显式 Graph State；只保存允许持久化的值 |
| Run 状态、请求幂等、操作记录、公开事件 | 应用持久化；不把 Checkpoint 当业务数据库 |
| client、连接、锁、凭证、callable | 可信执行依赖；不进入 State 或 Checkpoint |
| 大型原始响应、文件、正式产物（扩展时） | Artifact Store；State 保存 ID/hash/schema version 等引用 |
| HTTP 输入输出 | 专用 Pydantic DTO；不直接暴露 Graph State |

新增字段说明是否可缺省、是否敏感、如何序列化、恢复兼容性。版本变化不能依赖“Python 没报错”来证明旧 Checkpoint 可恢复。

## 并行与 reducer（扩展时）

先让独立分支写独立字段或按稳定 task ID 返回结果，再显式汇合。同一字段需要合并时声明 reducer；reducer 不做 I/O，说明顺序、重复和冲突策略，并以不同完成顺序验证结果。

列表拼接不是幂等去重。可能重放的结果按稳定身份接受，旧 attempt 不能覆盖新 attempt；fan-out 要保存预期任务集合，不把“已有一些返回”当收齐。需要全分支完成的 fan-in 使用明确 join，不依赖调度顺序。

Subgraph 应有清楚输入/输出映射与 Checkpoint namespace；不要把所有 messages 无限制广播给子 Agent。拆出子图也不改变授权、预算和发布边界。

## interrupt（扩展时）

人工等待先设计应用状态与回答契约，再调用 `interrupt()`。继续同一等待使用同一 `thread_id` 与 `Command(resume=...)`；恢复会从 Node 开头重跑，不能理解成从 Python 断点下一行继续。interrupt 前的副作用必须安全重放，不捕获并吞掉 `GraphInterrupt`，不在有历史 Checkpoint 时随意重排同 Node 中多个 interrupt 的顺序。

具体等待身份、重复回答和恢复验证见 [恢复规范](checkpoint-and-effects.md)；框架行为见 [官方 interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)。当前服务尚无相应 HTTP 控制接口。
