# 公司研究前端接入问题记录

> 历史参考：仅描述复制代码对应的旧服务；当前接口以 [接入入口](README.md) 链接的新合同为准。

> 核对日期：2026-07-31
>
> 接口基线：`../specs/api-specs/产品服务接口文档.md` V1.6
>
> 范围：只记录前端请求、DTO、状态转换和页面展示问题；不记录服务端 ownership、历史过滤、落库或其他服务端边界问题。

## 已处理

| 编号   | 问题                                                           | 前端处理                                                                                                                                                                 |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FE-001 | 歧义识别响应中的 `conversationId` 未传入创建任务               | recognition SSE DTO 保留 `conversationId`；仅 `AMBIGUOUS` 创建任务时携带原始 `query` 和 `conversationId`。 `RESOLVED` 由服务端自动创建任务。                             |
| FE-002 | V1.4 `systemMessages`、`agents[]` 和 `messages[]` 未解析或展示 | DTO 解析 Agent 元数据、消息 ID、序号、状态、进度和 JSON `metadata`；进度页按 Agent 行内展示可见思考事件、摘要和来源。                                                    |
| FE-003 | Long ID、`seq` 在不同 JSON 序列化方式下可能被当作无效字段      | Task、recognition、candidate、message、AgentRun ID 统一转为 string；消息序号、进度和 SSE 序号兼容数字/数字字符串。                                                       |
| FE-004 | SSE `done` 事件关闭连接后仍可能进入重连循环                    | `done` 与任务完成/部分完成/失败事件统一作为终态；终态事件缺少 `taskId` 时回退使用 `projectId`。                                                                          |
| FE-005 | Agent 状态只读取 `capabilities[]`，详情返回的 Agent 状态被忽略 | 以 `capabilities[]` 建立完整列表，再按规范化 capability 名覆盖 `agents[]` 的状态、名称、摘要、进度和错误信息。                                                           |
| FE-008 | Task 详情新增可选消息体，所有页面继续默认拉取会造成重复传输    | 进度页传 `includeMessages=true`；结果页、Agent 报告页和公司详情页传 `false`；两种快照使用独立缓存 key。                                                                  |
| FE-009 | SSE `progress` 改名为 `agent_progress` 并增加 Agent 上下文     | API 层解析 Agent ID、名称、进度、摘要、事件类型、技能和来源引用；事件只触发 Task 快照刷新，不在前端累加状态。                                                            |
| FE-010 | 游客识别接口明确要求 `X-Device-Id`                             | 公共 request client 已统一注入 `X-Device-Id`；recognition SSE fetch 手动带上该 Header，识别页面不重复拼接。                                                              |
| FE-011 | `POST /recognitions` 删除，识别改为异步 SSE                    | API repository 使用 GET + `text/event-stream` 解析 `recognition_started`、`recognition_result`、识别错误和任务事件；识别流断线不自动重发，避免重复识别。                 |
| FE-012 | `RESOLVED` 由服务端自动创建任务，前端仍重复调用 `POST /tasks`  | 启动表单等待带 `taskId` 的任务事件进入进度页；只有 `AMBIGUOUS` 候选确认后调用 `POST /tasks`。                                                                            |
| FE-013 | V1.5 统一报告改为 `{ report, reportMarkdown }` 双结构          | DTO 解包结构化 report 与 Markdown 正文；结果页优先展示完整 Markdown，旧任务或 Markdown 缺失时回退结构化报告；helper 同时兼容 camelCase 与 snake_case。                   |
| FE-014 | Task 结论新增最大机会与最大风险字段                            | DTO 接收 `maximumOpportunity / maximumRisk`，归一到既有领域字段，并兼容旧命名与 snake_case，供分享等 Task fallback 场景直接使用。                                        |
| FE-015 | V1.6 识别和任务创建新增研究语言 `language`                     | 从当前 UI locale 映射 `zh` → `zh-CN`、`en` → `en-US`，透传到识别 SSE 和歧义候选创建任务；TaskVO 同步解析语言，非法或缺失值安全回退为 `unknown`。                         |
| FE-016 | V1.6 增加项目/Agent 状态推送和报告就绪语义                     | 解析 `status_change`、`capability_status` 的状态事件；`progress=100` 仍展示报告生成中，只有 `SUCCEEDED` 且 `reportReady=true` 才读取报告；报告拉取失败按 `FAILED` 展示。 |

## 待接入

| 编号   | 问题                                                   | 影响                                                                                 | 建议的前端处理                                                                                                                                                 |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-006 | `GET /v1/research/recognitions/{recognitionId}` 未接入 | 用户在识别确认或候选选择阶段刷新页面后，当前表单只能丢失内存状态，无法恢复候选对话。 | 增加 recognition 查询方法，并用带版本的 `localStorage` 保存 `recognitionId`、原始 query 和恢复时间；恢复成功后重新打开候选选择状态，创建任务或结束流程后清理。 |
| FE-007 | `POST /v1/research/tasks/{taskId}/cancel` 尚无页面操作 | 运行中的研究只能等待服务端终态，用户无法从进度页主动取消。                           | 在任务处于非终态时增加取消按钮、确认交互、mutation pending 状态和取消后的 Task 刷新；不把取消请求误当作失败重试。                                              |

## 验收边界

- `systemMessages` 或 `agents` 缺失时，进度页继续使用已有 Task/capability 展示，不因新增字段缺失崩溃。
- `metadata` 无法解析时不阻断 Task；消息正文仍可展示。
- 长 ID 以 string 传递和作为 React Query key、路由参数使用，避免 JavaScript number 精度损失。
- SSE 断线只触发 Task 快照刷新；不在前端累加 Agent 状态或推算阶段进度。
- 研究语言只提交服务端允许的 `zh-CN` 或 `en-US`；Task 返回未知语言时不阻断页面。
- `RUNNING + progress=100` 仍属于报告生成阶段；只有 `SUCCEEDED` 才可进入 Agent 报告读取流程，`FAILED` 保留思考记录并展示失败原因。
- 服务端 `60` 分钟总超时和 `20` 分钟空转超时只作为接口边界记录；前端不复制计时和强制失败逻辑。
