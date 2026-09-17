# 公司研究接口前端接入说明

> 历史参考：仅描述复制代码对应的旧服务；当前接口以 [接入入口](README.md) 链接的新合同为准。

> 状态：现有页面已按 product-server V1.6 契约接入核心研究链路
>
> 更新日期：2026-07-31
>
> 产品基线：`docs/prd/company-research/ai-berkshire公司研究模块.md`
>
> 接口基线：`../specs/api-specs/产品服务接口文档.md` V1.6

V1.6 在 V1.5 识别 SSE 链路基础上，增加 `zh-CN/en-US` 研究语言透传、明确 Agent 报告 `reportReady` 和项目/Agent 终态语义，并将历史接口纳入进行中任务。

前端使用当前 UI locale 映射研究语言：`zh` → `zh-CN`，`en` → `en-US`。`progress=100` 只表示思考阶段完成，不能替代 `capability_status` 的最终状态。

V1.4 同时保留 V1.3 的 `conversationId`、`includeMessages`、`agent_progress`、Agent 历史和 `X-Device-Id` 约定。研究总超时和空转超时属于服务端边界，前端只按服务端终态展示，不在浏览器本地复制计时规则。

## 1. 接入范围

| 页面或能力      | 接口                                                            | 前端处理                                                                                      |
| --------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 邮箱验证码      | `POST /api/v1/account/email-code/send`                          | 发送登录/注册验证码，成功后启动本地冷却计时                                                   |
| 邮箱登录/注册   | `POST /api/v1/account/email-code/login`                         | 保存 JWT 和服务端用户信息，首次用户由服务端自动注册                                           |
| Google 登录     | `POST /api/v1/account/google-login`                             | 配置 `VITE_GOOGLE_CLIENT_ID` 后提交 GIS credential                                            |
| 管理员登录      | `POST /api/v1/account/password-login`                           | 仅管理员账号可用，普通用户使用邮箱或 Google                                                   |
| 会话校验/退出   | `GET /api/v1/account/me` + `POST /api/v1/account/logout`        | 启动时校验持久化会话；退出始终清理本地状态                                                    |
| 研究发起        | `GET /api/v1/research/recognitions?query=&language=`            | 使用 fetch SSE；透传 `zh-CN/en-US`，处理识别结果、任务事件、终态和识别错误                    |
| 创建任务        | `POST /api/v1/research/tasks`                                   | 仅候选有歧义时携带 `recognitionId + candidateId + query + conversationId + language` 创建任务 |
| 识别结果回查    | `GET /api/v1/research/recognitions/{recognitionId}`             | 当前 API repository 尚未接入，详见前端问题记录                                                |
| 研究进度        | `GET /api/v1/research/tasks/{taskId}`                           | 展示 TaskVO、Agent 状态、会话系统消息和 Agent 消息历史                                        |
| 实时进度        | `GET /api/v1/research/tasks/{taskId}/events`                    | 使用带鉴权 header 的 fetch SSE；解析 `agent_progress` 后触发 Task 快照校准                    |
| 取消任务        | `POST /api/v1/research/tasks/{taskId}/cancel`                   | 当前页面未提供取消操作，详见前端问题记录                                                      |
| capability 重试 | `POST /api/v1/research/tasks/{taskId}/retry`                    | 仅失败 capability 可重试，成功后刷新 Task                                                     |
| 统一报告        | `GET /api/v1/research/tasks/{taskId}/report`                    | 解包 `{ report, reportMarkdown }`；优先展示完整 Markdown，缺失时展示结构化字段                |
| Agent 报告      | `GET /api/v1/research/tasks/{taskId}/capabilities/{capability}` | 独立获取 Markdown、结构化输出和来源                                                           |
| 公司详情        | Task + Report                                                   | 由同一任务与报告派生，不请求不存在的公司详情接口                                              |
| 历史分析        | `GET /api/v1/research/history`                                  | 服务端分页、关键词搜索                                                                        |
| 删除历史        | `DELETE /api/v1/research/history/{taskId}`                      | 成功后更新当前列表缓存                                                                        |
| 保存匿名报告    | `POST /api/v1/research/tasks/{taskId}/bind`                     | 登录返回报告页后绑定原任务，不重新执行研究                                                    |
| 分享图片        | 本地生成 + `POST /api/v1/files/upload`                          | 本地预览、下载；平台图片分享时上传生成的海报                                                  |

登录 / 注册由 `VITE_DATA_SOURCE` 控制，公司研究业务由 `VITE_RESEARCH_DATA_SOURCE` 控制；两者均默认 `api`。显式设置为 `mock` 时仍可进行离线开发，API mode 不回退 Mock。

## 2. 请求链路

浏览器统一请求同源 `/api`：

```text
Browser /api/v1/*
  -> local: Vite proxy (DEV_PROXY_TARGET)
  -> production: Caddy reverse_proxy (BACKEND_ORIGIN)
  -> product-server /api/v1/*
```

```text
VITE_API_BASE_URL=/api
VITE_DATA_SOURCE=api
VITE_RESEARCH_DATA_SOURCE=api
DEV_PROXY_TARGET=https://ai-bershire-product-server-production.up.railway.app
BACKEND_ORIGIN=https://ai-bershire-product-server-production.up.railway.app
```

公共 request client 自动为 HTTP 请求携带 `X-Device-Id`；识别 SSE 使用 fetch 手动设置相同 header，登录后追加 `Authorization: Bearer <JWT>`。开发代理和生产反向代理均指向 `https://ai-bershire-product-server-production.up.railway.app`。

### 2.1 识别 SSE

```text
GET /api/v1/research/recognitions?query=NVIDIA&language=en-US
Accept: text/event-stream
X-Device-Id: <device-id>
```

前端按事件处理：

- `recognition_started`：进入识别中的 pending 状态。
- `recognition_result`：解析 `conversationId`、`recognitionId`、`status` 和最多五个候选。
- `RESOLVED`：不再调用 `POST /tasks`；等待带 `taskId` 的任务事件后进入进度页。
- `AMBIGUOUS`：打开候选选择；用户确认后调用 `POST /tasks`，并把原始 `query`、`conversationId` 一起传回，继续消费原 SSE。
- `recognition_error` + `done`：结束识别并展示服务端错误信息。
- `task_complete`、`task_partial`、`task_failed`：视为任务终态，关闭当前识别 SSE；任务进度页按 Task 接口读取最终快照。

识别 SSE 断线不自动重新发起同一个 GET，因为该请求会创建新的 conversation 并重复识别；前端将错误恢复为可重新提交状态。任务事件 SSE 仍使用 `afterSeq` 续传。

## 3. DTO 与领域映射

### 3.1 Task 状态

| V1.4 API         | 页面语义                                     |
| ---------------- | -------------------------------------------- |
| `PENDING`        | 等待开始                                     |
| `COLLECTING`     | 正在收集资料                                 |
| `ANALYZING`      | 正在分析                                     |
| `SYNTHESIZING`   | 正在整理结论                                 |
| `SUCCEEDED`      | 最终报告已成功拉取                           |
| `PARTIAL_FAILED` | 部分完成，可在 `reportReady=true` 时查看报告 |
| `FAILED`         | 研究失败                                     |
| `CANCELLED`      | 已取消                                       |
| 其他值           | 未知状态，保留刷新和返回入口                 |

前端兼容旧值 `RESOLVING / COMPLETED / PARTIAL`，但不把未知值强制断言为已知状态。

Agent 状态只按 `capabilities[].status` 或 `agents[].status` 展示：`RUNNING + progress=100` 仍是“报告生成中”，只有 `SUCCEEDED` 才允许进入 Agent 报告接口；`FAILED` 保留思考记录并提供重试入口。

### 3.2 识别候选

V1.4 的公司信息位于 `candidates[].company`，识别结果通过 SSE event data 返回并额外包含 `conversationId`。DTO 边界映射：

```text
company.name       -> companyName
company.legalName  -> companyLegalName
company.ticker     -> stockCode
company.market     -> market
company.exchange   -> exchange
company.industry   -> industry
company.keyPeople  -> keyPeople
researchable       -> canResearch
unsupportedReason  -> disabledReason
```

候选最多展示五个；`researchable=false` 时禁用选择并显示服务端原因。

候选有歧义并完成选择后，创建任务请求使用同一轮输入构造；`RESOLVED` 流程不发送此请求：

```json
{
  "recognitionId": "rec_xxxxx",
  "candidateId": "candidate-nvda-us",
  "query": "黄仁勋",
  "conversationId": "1890001493837324289",
  "language": "zh-CN"
}
```

### 3.3 Task 字段

页面直接消费 `language / exchange / industry / keyPeople / researchFocus / reportReady`。`taskId` 始终按 string 保存，避免长整型精度损失。未返回的可选字段不展示，不从其他字段推算。

`conclusion` 按 V1.5 接收 `decision / confidence / companyQuality / valuationStatus / longTermOutlook / maximumOpportunity / maximumRisk`。DTO 边界将 `maximumOpportunity / maximumRisk` 归一为前端既有的 `biggestOpportunity / biggestRisk` 领域字段，并兼容旧字段名和 snake_case；页面与分享 mapper 不直接处理服务端别名。

### 3.4 会话消息与 Agent 历史

`GET /research/tasks/{taskId}` 的 `includeMessages` 默认值为 `true`。为避免结果和详情页重复拉取较大的消息体，页面按用途选择：

| 页面                   | `includeMessages` | 原因                                               |
| ---------------------- | ----------------- | -------------------------------------------------- |
| `ResearchProgressPage` | `true`            | 需要展示 Agent 历史和按 Agent 分配的实时思考过程。 |
| `ResearchResultPage`   | `false`           | 结果页通过报告接口获取报告，不需要消息历史。       |
| `AgentReportPage`      | `false`           | Agent 报告页通过 capability 接口获取独立报告。     |
| `CompanyDetailPage`    | `false`           | 公司详情只依赖 Task 基础字段和统一报告。           |

前端为 true / false 两种快照使用不同的 React Query key；SSE、重试和绑定成功时按 Task key 前缀同时刷新两种缓存。服务端返回 `null` 的消息字段在 DTO 层视为缺失，不阻断基础 Task 展示。

详情字段只在存在时展示：

- `systemMessages[]` 随任务快照返回，保留系统/识别/选择/结论上下文；进度页不再单独渲染全局活动卡片，避免与 Agent 轨迹重复。
- `agents[]` 作为 Agent 元数据列表，展示 `displayName`、`skillName`、`eventAgentName`、`status`、`progress`、`summary` 和错误信息。
- `agents[].messages[]` 按 Agent 行内展示；`THINKING` 消息的 `metadata` 在 DTO 边界从 JSON 字符串解析为结构化值，按 `seq` 去重排序并展示用户可见的事件、摘要和来源链接。
- 长 `REPORT` 消息默认折叠，完整报告仍通过统一报告或 Agent 报告页面阅读。
- `capabilities[]` 作为兼容字段保留；进度页以它建立完整 Agent 列表，再用 `agents[]` 覆盖状态和展示信息，避免部分 Agent 尚未产生消息时从页面消失。

### 3.5 报告与 Agent 结果

- 统一报告在 DTO 边界解包为 `report` 与可选 `reportMarkdown`；`report` 保持递归 JSON domain type，并兼容旧任务的 snake_case 裸响应。
- `reportMarkdown` 存在时结果页展示完整 Markdown；为空时按结构化 `report` 实际存在的字段展示，不补造缺失内容。
- Markdown 只使用 `MarkdownContent` 渲染。
- 单 Agent 接口的 `normalizedOutput` 与 `sources` 是 JSON 字符串；只在 DTO 边界 `JSON.parse`，无效 JSON 保留为普通字符串。
- 单 Agent 接口的 `reportReady` 是报告是否可展示的权威字段；缺少该字段时只兼容推断接口响应中确实存在的报告内容。
- `reportReady=false` 时不请求统一报告。
- `overallConclusion` 按 PRD 固定展示七项结论字段；缺失或值为 `insufficient_data` 时显示本地化的“数据不足”，不保留空标签，也不把该占位当作有效结论写入分享内容。
- 其他结构化报告空字段不展示，不用整段 `JSON.stringify` 代替页面结构。

### 3.6 SSE Agent 进度

服务端已将旧的 `progress` 事件改为 `agent_progress`。前端在 API 边界解析以下字段，并保留长 ID 为 string：

```text
agentRunId / agentName / displayName / progress / summary
title / eventType / skillName / visibility / sourceRefs
```

`agent_progress`、`status_change` 和 `capability_status` 都只触发当前 Task 快照刷新；Agent 状态、摘要和进度以 REST TaskVO 为准，不在前端按 SSE 事件自行累加或推算阶段状态。这样可以兼容断线重连、重复事件和服务端最终校准。

`capability_status` 的 Agent 标识兼容服务端使用的 `name` 字段；收到 `SUCCEEDED` 后再通过 capability 接口读取报告。

## 4. 错误与恢复

- 成功响应按 V1.5 的 `{ code, message, data }` 解包，同时兼容旧裸响应。
- Task、Report、Agent 报告失败时保留 URL 和重试入口。
- `PARTIAL_FAILED` 且 `reportReady=false` 时显示报告尚不可用，不循环请求。
- SSE 重复、乱序或断线不直接累加业务状态，只刷新 Task 快照；`agent_progress` 是新的 Agent 进度事件，`task_complete`、`task_partial`、`task_failed` 和 `done` 都视为终态，收到后停止重连。
- SSE 事件优先使用 `data.seq`，兼容 SSE `id`；终态事件缺少 `taskId` 时使用 `projectId` 作为任务标识回退。
- recognition SSE 与任务事件 SSE 使用不同恢复策略：recognition 只允许用户主动重新提交，任务事件按 `afterSeq` 自动续传。
- retry、delete、bind 均以 mutation pending 和 action guard 防重复。
- 分享链接直接使用当前页面 URL，不调用服务端 snapshot 创建接口。
- 前端不再注册公开 snapshot 路由，也不读取公开分享快照；接收者按当前页面已有的访问权限打开链接。
- 未知状态、字段缺失或新增字段不得导致页面崩溃。
- 最终报告拉取失败按服务端返回的 `FAILED + failReason` 展示，不把 `progress=100` 或旧的成功事件当作报告已就绪。

### 4.1 服务端边界说明

当前服务端约定研究任务最长 `60` 分钟未完成后强制失败，连续 `20` 分钟无新事件后强制失败。该计时、强制终态和数据清理属于服务端职责；前端不实现本地倒计时、不自行把任务标记为失败，只展示服务端返回的状态和失败原因。

## 5. 前端问题记录

前端接入范围内的问题和未接入能力见 [company-research-frontend-gaps.md](./company-research-frontend-gaps.md)。服务端 ownership、历史过滤、数据落库等边界问题不在本次前端分析范围内，另见 [company-research-backend-gaps.md](./company-research-backend-gaps.md)。

## 6. 验收边界

- 刷新进度、结果、Agent 报告和公司详情页不会创建新任务。
- 发起流程只提交用户输入、识别结果中的 `conversationId` 和选中的候选，不提供研究模式或研究重点设置。
- API mode 中所有页面只显示服务端真实返回的数据，不读取 runtime Mock 补位。
- `SUCCEEDED` 与 `PARTIAL_FAILED + reportReady=true` 可进入统一结果页；Agent 详情还必须满足 capability 接口返回 `reportReady=true`。
- Agent 详情使用独立 capability endpoint，不从统一报告伪造独立结果。
- 复制和平台分享使用当前页面 URL，不再生成或使用 `/share/:token` 链接。
- 历史搜索只发送服务端已定义的单一 `keyword`；PRD 的多字段、多关键词 AND 能力等待服务端补齐。
- 七阶段没有服务端 read model 时保留结构和明确占位，不推算阶段状态。
- 邮箱、Google、管理员登录、会话校验和退出均使用正式账户接口；测试环境单独固定为 Mock。
- 前端 API 运行时仍通过同源 `/api` 代理，开发代理和生产 `BACKEND_ORIGIN` 均指向 `https://ai-bershire-product-server-production.up.railway.app`。
