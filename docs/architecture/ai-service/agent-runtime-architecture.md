> 本文是目标架构，不是完成清单；当前实现见 [落地边界](../README.md)。

# AI Server 通用 Agent Runtime 架构

> 状态：架构基线。当前目录只定义通用能力与边界，不代表运行代码已经实现或验证。

## 1. 目标与边界

AI Server 为不同产品提供可复用的 Agent Runtime，负责运行生命周期、工作流执行、模型与工具调用、持久化恢复、预算、人工中断、产物、事件和观测。

具体产品负责定义输入输出 schema、业务工作流、提示词、工具权限、完成条件和评估样本。通用层不包含行业实体、业务公式、页面交互或特定报告结构。

首期采用一个 Python 包、一个 API 进程和一个 Worker 进程。API 与 Worker 使用同一版本构建，但职责分离：API 接收命令和提供查询，Worker 推进工作流。

## 2. 模块结构

```text
ai-service/
  src/ai_service/
    api/               HTTP、认证、公开 DTO、SSE
    application/       Run 命令、事务、状态投影
    agent_core/        Runner、台账、预算、恢复、公共端口
    workflows/         业务工作流注册与装配
    infrastructure/    数据库、模型、工具、存储、观测适配
    resources/         版本化提示词、policy 与 workflow 配置
  tests/
    unit/
    integration/
    replay/
    evals/
```

依赖方向固定为 `api → application → agent_core`。`workflows` 组合 core 端口表达产品流程，`infrastructure` 实现端口。core 不依赖具体供应商 SDK 或业务模块。

首期通过静态注册表加载 workflow、tool 和 policy。出现多个真实业务使用者后，再评估插件化或独立包发布。

## 3. 运行路径

```text
创建 Run
  → 冻结输入、workflow/schema/policy 版本与预算
  → 同事务写入 Run 和待执行命令
  → Worker 领取命令并取得 Run 排他锁
  → Runner 从 checkpoint 开始或恢复
  → Workflow 节点通过统一调用边界使用模型和工具
  → 保存原始响应、产物引用、预算与应用事件
  → 完成门禁决定 completed / partial / blocked / failed
  → 发布不可变结果并更新公开快照
```

浏览器或调用方断开不影响 Run。SSE 只传播已持久化事件，不承担任务队列职责，也不以连接结束代表运行完成。

## 4. 公共契约

| 对象 | 最少职责 |
|---|---|
| `RunManifest` | scope、规范化输入、workflow/schema/policy 版本、能力和预算快照 |
| `TaskAttempt` | task、attempt、依赖、状态、输入与输出引用 |
| `Operation` | 稳定操作身份、payload hash、外部交换和正式响应引用 |
| `Artifact` | kind、schema version、content hash、scope、输入引用和存储位置 |
| `RunEvent` | run 内单调 sequence、公开事件类型和安全 payload |
| `CompletionResult` | 执行终态、业务结果质量、正式结果引用和未决问题 |

运行状态与业务结果质量分开。`completed` 表示执行合法结束，不自动说明业务结果完整或正确。所有外部边界执行 schema 校验；未知值使用 `null` 和原因，不用伪造默认值。

## 5. 持久化与恢复

运行事实分为三类：

- LangGraph Checkpointer 保存图位置、节点状态和人工中断。
- 应用数据库保存 Run、命令、操作台账、预算、事件、回答和产物元数据。
- Artifact Store 保存大型原始响应与不可变产物正文。

外部请求按以下顺序处理：冻结交换并 checkpoint，登记 attempt 与预算预留，提交后调用供应商，先保存完整响应和已知用量，再把 `response_ref` 返回工作流。

节点重放时优先复用已保存响应。请求可能已发送但响应未保存时标记 `unknown`，保留预算，不自动重发。Checkpointer 与远端调用不构成同一事务，系统不承诺远端副作用或费用 exactly-once。

每个 Run 同一时间只允许一个执行者推进。多 Worker 模式必须额外实现 claim、heartbeat、fencing 和旧执行者隔离，不能只增加进程数量。

## 6. 模型、工具与上下文

所有模型和工具调用经过统一端口：

- `ModelPort` 负责结构化输入输出、原始响应和 usage。
- `ToolRegistry` 只暴露显式注册并通过权限检查的工具。
- `ContextAssembler` 按任务选择必要上下文，保留来源和裁剪记录。
- `BudgetPolicy` 在请求发出前预留请求数、token、时间和可验证费用。
- `OperationLedger` 保存每次外部交换、响应、重试和未知消费。

模型不能扩大 scope、注册工具、修改预算或绕过完成门禁。网页、文件、工具结果、历史记忆和模型输出都按不可信数据处理，其中的指令不获得系统权限。

Planner、MCP、RAG、模型路由、缓存、长期记忆和多 Agent 团队均为按需扩展。启用后仍复用既有授权、版本、台账、预算、产物和评估边界。

## 7. HTTP 与事件

首期公共接口保持业务中性：

| 接口 | 作用 |
|---|---|
| `POST /api/v1/runs` | 创建 Run，使用 `Idempotency-Key` 冻结输入和 profile |
| `GET /api/v1/runs/{run_id}` | 获取公开快照，不驱动工作流 |
| `GET /api/v1/runs/{run_id}/events` | 按 sequence 续读 SSE 事件 |
| `POST /api/v1/runs/{run_id}/answers` | 提交人工中断回答 |
| `POST /api/v1/runs/{run_id}/continue` | 从可恢复故障继续 |
| `POST /api/v1/runs/{run_id}/cancel` | 幂等登记取消意图 |
| `POST /api/v1/runs/{run_id}/revisions` | 基于已有 Run 创建关联修订 |
| `GET /api/v1/runs/{run_id}/result` | 获取正式发布的结构化结果 |
| `GET /api/v1/artifacts/{artifact_id}` | 经 scope 与类型授权读取产物 |

公开 DTO 不暴露 ORM、LangGraph State、供应商响应或内部推理。应用事件使用稳定类型和安全摘要；调用方通过快照校准重复事件、断线和过期游标。

## 8. 安全与部署

本地开发默认使用 deterministic 或 recorded 模式。启用真实模型、搜索或其他付费服务时，必须由可信配置提供凭证、供应商、额度和网络范围。

公开服务至少具备认证、逐资源授权、并发与预算限制、日志脱敏、产物访问控制、数据库备份和恢复演练。通用 Runtime 不默认开放 shell、任意代码执行或浏览器控制。

首期可以使用 PostgreSQL 命令箱和单 Worker，不把 Redis、Celery、消息总线或 Kubernetes 作为前置条件。部署需要分机或弹性扩容时，再替换命令投递和 Artifact Store 实现，运行事实仍由应用数据库和 checkpoint 共同持有。

## 9. 验收基线

实现后至少验证以下场景：

- 同 scope、同请求幂等；不同内容复用请求键时明确冲突。
- 在首个 checkpoint 前、响应保存后、发布前和发布后崩溃时正确恢复。
- 请求发送事实不明时进入 `unknown`，不会未经授权自动重复付费。
- 重复 Worker 投递只产生一次有效推进和一次预算预留。
- 人工回答幂等消费，过期回答不会恢复错误节点。
- 取消后的迟到响应只进入台账，不覆盖正式结果。
- schema、权限、预算、工具参数或版本不兼容时明确阻断。
- 观测服务不可用时业务事实仍正确，降级状态可见。
- prompt injection 不会扩大权限、泄露秘密或写入未经授权的长期记忆。

deterministic 测试证明协议和恢复；recorded 测试证明解析与回归；live 测试需要明确授权和预算，并记录模型、数据时间、费用与波动。三类证据不可互相替代。

## 10. 业务接入规则

新业务只需增加 workflow、业务 schema、提示词与 policy、工具适配和 eval cases。业务模块可以定义自己的阶段与交付质量，但不得重新定义 core 的 Run 状态、幂等、恢复、预算和权限语义。

当第二个业务接入时，以真实重复点为依据提取公共能力；不要预先创建万能 `BaseAgent`、动态插件市场或独立平台服务。
