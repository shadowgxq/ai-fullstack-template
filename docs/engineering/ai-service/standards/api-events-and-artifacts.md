# API、事件、产物与观测

具体字段和状态以 [跨端契约](../../../contracts/README.md) 及提供方 schema 为准；本文维护实现方式，不复制另一份接口规格。

## API 与 DTO

API 只接收命令与读取公开状态，不执行 workflow；查询或浏览器断开都不改变任务生命周期。认证/逐资源授权在服务边界完成，受信 scope 不能被 body 中的 tenant/owner 覆盖。

公开 Pydantic DTO 与 Graph State、数据库 row、供应商响应分开；handler 显式映射并使用 response model。输入约束、状态码、鉴权声明、稳定 operation ID 与错误说明一起维护，避免自动生成文档漏掉运行时行为。

当前 AI API 使用原生 DTO 和 FastAPI `{detail: ...}`，不要机械套用 backend 的 `{code,message,data}`。当前只有 `queued/running/completed/failed`，新增等待、取消或结果质量语义必须同步应用存储、迁移、DTO、消费者和测试，不能只改文档枚举。

结构 schema 仍由代码导出到 `docs/contracts/generated/`，不手工修改生成文件。`make contracts` / `make contracts-check` 的定义见 [根 Makefile](../../../../Makefile)。导出使用隔离的测试配置，不连接真实数据库、模型或搜索；生成 schema 不代替语义回归。

## 事件：当前 JSON，SSE 扩展

当前事件是持久化 JSON 轮询，不是 SSE。按 Run 的 sequence 排序续读；状态快照与 last_sequence 用于校准，不使用进程内从零开始的计数器或 timer 伪造进度。

接入 SSE 时，只推送已提交的公开应用事件。事件 ID 对应稳定续读位置；客户端重复消费可去重，过期游标应明确要求重取快照。快照中的 High-Water Mark 表示该快照已覆盖的事件边界；不能用另一次不一致查询得到的最大序号冒充。

SSE 需要处理断线、慢消费者、有界缓冲、心跳和连接清理，但不持有长数据库事务，也不承担任务队列职责。流结束不等于 Run 完成；不得直接转发 LangGraph 内部事件、供应商 token 或内部推理。

## Artifact 与发布（扩展时）

按 [ADR-0004](../../../architecture/ai-service/decisions/0004-immutable-delivery.md) 实现不可变 Candidate、Audit、Delivery：正文、hash、schema version、scope 和引用要能核对；修订生成新版本，不覆盖已审核正文。

同机方案由 Worker 原子写入持久存储，再登记有效引用；API 授权后只读。同机文件写入与数据库提交不是同一事务，需要明确孤立文件清理和重试策略，不发布指向未完成正文的引用。不能把容器临时目录作为唯一存储，也不能接受任意路径下载。

Audit 绑定实际 result/policy hash；Release Gate 在正式引用提交时检查取消、权限与输入版本。Artifact 同 scope 不代表可以下载草稿或绕过发布限制。分机前先更换共享存储方案，不能让 API/Worker 各读自己的本地目录。

## 错误与观测

| 类别 | 处理原则 |
|---|---|
| 输入/鉴权/资源/状态冲突 | 稳定公开错误，按现有契约映射；不靠重试修复权限错误 |
| 存储不可用或 Worker 失锁 | 明确失败/中止，遵循恢复规范；不返回伪造成功 |
| 工具/模型失败或解析错误 | 记录已知调用结果，由统一调用边界决定重试；不统一伪装为“资料不足” |
| `unknown`（扩展时） | 保留不确定性与预算，不盲重发 |
| interrupt / 取消控制信号（扩展时） | 映射为明确控制状态，不当普通异常吞掉 |

Worker 入口已启用 [JSON 日志](../../../../ai-service/src/ai_service/infrastructure/logging.py)，失败记录关联 run_id、安全错误码和异常类型。formatter 只序列化允许的上下文字段，不输出任意 extras 或异常正文；消息本身仍由调用者保持安全，不宣称 formatter 能识别所有秘密。API 日志沿用 Uvicorn；metrics、Langfuse 和远端 tracing 尚未接入。

扩展时按可用信息追加 operation_id/attempt 与节点；原始响应进入受控存储，不直接写公开日志。观测 adapter 可以 Noop，必须脱敏、有界并能降级；trace 丢失不应导致重复执行或破坏持久事实。应用事件与 Operation Ledger 不能因为远端观测不可用而跳过写入；不得用 trace 判断操作是否已经完成。
