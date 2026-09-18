# AI 服务专项规则

先读 [已实现与目标边界](../../architecture/README.md)，涉及恢复再读 [目标架构](../../architecture/ai-service/agent-runtime-architecture.md)。

`api → application → agent_core`；workflows 组合业务步骤，infrastructure 提供数据库等适配。core 不依赖模型 SDK 或业务模块。application 仅依赖 core 的 RunStore Protocol；API 组合根注入 PostgreSQL Store，单元测试可注入内存替身。

API 只收命令与读快照；Worker 执行图。Run 与待执行命令同事务写入，事件先持久化再读取；LangGraph checkpoint 不替代应用状态。持有 PostgreSQL 会话级排他锁的同一连接完成 checkpoint 与应用状态写入；连接丢失必须终止旧执行者，不能另开 saver 连接继续写。当前只能一个 Worker。

同 scope/key 的输入 hash 必须稳定；不同请求复用键返回冲突。已完成结果不可覆盖。输入/输出与 checkpoint 版本变化必须考虑历史运行恢复。

本次只有确定性 echo，无外部副作用。不要直接把节点换成付费模型：应先实现预算预留、OperationLedger、unknown 响应、授权和 replay 评估。人工中断、取消、SSE、产物发布均不得伪装为已支持。

测试区分 unit / PostgreSQL integration / 独立进程 smoke。未配置测试库导致 skipped 不是验证成功；真实模型测试必须另行授权。
