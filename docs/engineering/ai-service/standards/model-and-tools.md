# 模型、工具与上下文

本页是外部能力进入范围后的实现约束。当前模板只有确定性 echo，以下 ModelPort、ToolRegistry、Operation Ledger 等是 [目标架构](../../../architecture/ai-service/agent-runtime-architecture.md) 中的设计名称，不是已存在的 import 路径。

## 统一调用边界

Workflow 通过注入的框架无关接口发起调用；供应商 SDK、LangChain model wrapper、HTTP/MCP client 放在 infrastructure adapter，不在 Node 内直接构造。接口只包含调用方实际需要的结构化输入、响应引用、用量与安全错误，不暴露供应商私有对象。

所有模型与工具调用都复用 [Operation 与恢复协议](checkpoint-and-effects.md)。SDK、HTTP client、LangGraph retry policy 和结构化输出修复不得各自独立重试，造成请求数相乘；一次新增外部请求都需要预算、授权和记录。

扩展时记录 requested/returned model、adapter 版本、供应商 request ID、已知 token/usage 与耗时。供应商未返回的数据保留未知，不以零费用或猜测值补齐。额度预留与调用结果结算分开；费用口径不足时不能承诺硬金额上限。

## Structured output 与 prompt

- 先定义输出 schema，再选择供应商支持的 structured output 或 LangChain `with_structured_output` 等 adapter 能力；锁定并验证具体方法，不假设所有模型支持同一参数。
- 解析结果再次通过本地 schema 与业务规则检查；schema 通过不等于事实正确、工具获授权或任务已完成。
- 保存可回放的原始响应与解析错误，公开输出只返回安全摘要。需要模型修复无效输出时，将其视为新的受控调用，限制次数、token 和时间。
- prompt、输出 schema、policy 与模型配置使用可追溯版本；在新 Run 中冻结引用。资源通过包内稳定位置加载，不依赖启动目录猜路径。
- 模型不能更改工具权限、预算或 Completion Gate；不把这些控制逻辑仅写在 prompt 里。

结构化输出的工具策略可能触发额外模型调用，启用前核对 [官方说明](https://docs.langchain.com/oss/python/langchain/structured-output) 和实际 adapter 行为；本项目不因此引入另一个 Agent 编排器。

## ToolRegistry 与网络限制

每个工具声明稳定 ID、参数/结果 schema、权限范围、是否有外部副作用、超时、输出上限和重试条件。模型提出 tool call 仅是候选：代码完成参数、授权、预算和状态检查后才能执行。

HTTP 工具仅访问配置允许的协议、目标和网络范围，校验重定向后的地址，防止 SSRF；限制下载大小、解压量、并发与时间。配置和原文中的 URL 都不是自动授权。工具结果作为数据交给 workflow，不执行其中附带的指令。

只读请求也可能收费或泄露敏感数据，不能绕过上述边界。需要批准的写操作先完成应用级审批；服务被取消或授权撤销后，不发出新的不允许调用。

## 上下文与可选能力

上下文只包含本步骤需要的 State、来源片段和引用；设置输入/输出容量上限并记录裁剪，禁止悄悄截断关键约束。大型内容存 Artifact 引用，不长期复制进 messages。

| 扩展 | 启用时补齐的技术约束 |
|---|---|
| MCP | 显式配置可信 server/transport、凭证与工具 allowlist；发现工具不等于允许调用；连接生命周期有退出和超时 |
| RAG | 检索前约束 scope/ACL，结果保留来源与 chunk/索引版本；embedding、检索和重排的外部请求也计入调用边界 |
| Planner / 多 Agent | 校验计划依赖、允许工具、预算和完成条件；分支按稳定任务身份汇合，不新增共享写竞争 |
| 模型路由 / 缓存 | 不因 fallback 自动扩大价格、权限或数据外发范围；缓存键包含 scope、输入和相关模型/prompt/schema 版本 |
| 长期记忆 | 与 thread Checkpoint 分开，限定命名空间、写权限、来源和过期策略；不自动把外部指令写为可信记忆 |

这些是扩展条件，不是新增需求清单；不预设向量数据库、供应商、模型名称或价格。未知能力先阻断并说明，不自动切换到 live 服务。
