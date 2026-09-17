# AI Berkshire 服务端契约缺口

> 历史参考：仅描述复制代码对应的旧服务；当前接口以 [接入入口](README.md) 链接的新合同为准。

> 核对日期：2026-07-29
>
> 产品基线：`docs/prd/company-research/ai-berkshire公司研究模块.md`
>
> 接口基线：`../specs/api-specs/产品服务接口文档.md` V1.1
>
> 源码基线：`../backend/product-server`

本文记录公司研究与账户接入中需要服务端或接口文档处理的问题。前端 DTO 差异已在本轮修正，不列为服务端缺陷。

## 阻断项

| 编号   | 问题                          | 证据与影响                                                                                                                                                                                                                            | 服务端验收条件                                                                                         |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| BE-001 | 匿名任务登录后无法绑定        | `ResearchTaskService.bindToUser()` 先调用 `ownershipService.checkOwnership()`；登录后 `ResearchOwnershipService.isOwner()` 只比较新用户 ID，而匿名任务 `userId=null`，不会回退请求中的原 `deviceId`，因此 PRD 19.2 的绑定流程返回 403 | bind 对未绑定任务同时校验原设备；校验通过后写入当前用户；其他设备或已绑定其他用户仍拒绝                |
| BE-002 | 历史列表过滤旧状态            | `ResearchHistoryService.listHistory()` 仍过滤 `COMPLETED / PARTIAL / FAILED`，V1.1 实际写入 `SUCCEEDED / PARTIAL_FAILED / FAILED / CANCELLED`；成功和部分完成任务不会出现在历史页                                                     | 查询过滤与 V1.1 状态统一，并覆盖登录用户和匿名设备分页测试                                             |
| BE-003 | 创建任务未保存原始 query      | V1.1 请求体只定义 `recognitionId + candidateId`，但 `ResearchTaskService.createTask()` 用未传入的可选 `query` 写入项目；返回的必填 `TaskVO.query` 可能为 null，历史页也丢失“原始研究对象”                                             | 服务端从 recognition 记录恢复原始 query，或把 query 明确列为必填契约并校验；TaskVO.query 始终非空      |
| BE-004 | retry 更新了错误的 Agent 名称 | 创建运行记录时保存 `cap.getName()`（V1.1 为 `investment_team` 等），retry 却以 `capability + "_agent"` 更新；原失败记录可能不会重置                                                                                                   | repository 更新、Runner 请求、TaskVO 和 capability endpoint 统一使用同一名称，并有失败到重试的集成测试 |

## 高优先级

| 编号   | 问题                             | 证据与影响                                                                                                                                                        | 服务端验收条件                                                                                        |
| ------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| BE-005 | 单 Agent 报告缺少 ownership 校验 | `getCapabilityResult()` 直接按 `taskId + capability` 查询，没有调用 `ownershipService.checkOwnership()`；与 V1.1 “所有权校验(403)”不一致                          | 与 Task/Report 使用相同的用户/设备归属校验                                                            |
| BE-006 | SSE 设备不匹配只告警             | `ResearchEventController.events()` 检测到匿名设备不匹配后仅记录 warning，仍创建 emitter                                                                           | 不匹配返回 403；登录用户按用户归属校验；补充匿名与登录测试                                            |
| BE-007 | Task 展示字段语义不完整          | `TaskVOConverter` 将 `objectName` 和 `companyName` 都映射为 `normalizedName`；创建任务未写入 `objectRelation`、`researchFocus`，也没有公司法定全称/稳定 companyId | TaskVO 按识别结果分别返回对象名、公司展示名/全称、关系和研究重点，字段语义与 PRD 6.4、12.1、20.2 一致 |
| BE-008 | ConclusionVO 少于接口文档        | V1.1 附录声明 `valuationStatus / longTermOutlook`，源码 `TaskVO.ConclusionVO` 仅有 `decision / confidence / companyQuality`                                       | DTO、转换器和文档统一；无法稳定提供的字段从接口文档移除                                               |

## 产品能力缺口

| 编号   | PRD 要求                                                                   | 当前接口                                               | 建议                                                       |
| ------ | -------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| BE-009 | 进度页七个固定阶段及每阶段状态                                             | Task/SSE 只有总状态、capability 状态和 progress        | 提供稳定 `stages[]` read model；不要要求前端按百分比猜阶段 |
| BE-010 | 历史按公司、代码、管理层、产品、业务等多字段搜索；多关键词 AND；大小写无关 | `keyword` 只匹配 `query / normalizedName`              | 明确搜索字段、分词和大小写规则，在服务端完成过滤与分页     |
| BE-011 | 历史卡片展示研究重点                                                       | 历史返回 TaskVO 但当前创建流程通常不写 `researchFocus` | 在任务创建时落库并稳定返回                                 |
| BE-012 | 报告元数据展示生成时间、财务周期、市场价格更新时间                         | Report schema 和 TaskVO 尚无稳定统一字段               | 在 Report DTO 定义 metadata schema，避免前端从正文推断     |

## 账户接口文档差异

| 编号         | 问题                    | 文档与源码差异                                                                                                                                                           | 建议验收条件                                                                                        |
| ------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| AUTH-DOC-001 | 邮箱验证码 scene 不一致 | V1.1 声明 `LOGIN / REGISTER / BIND`；`VerificationScene` 实际只有 `login_register / reset_password`，未知值还会静默回退 `login_register`                                 | 文档与服务端枚举统一；无效 scene 返回 400，不再静默接受；补充每个受支持 scene 的请求示例            |
| AUTH-DOC-002 | 发送验证码响应未定义    | V1.1 只描述请求，没有 Response；`SendEmailCodeResponse` 实际返回 `cooldownSeconds / expireSeconds`                                                                       | 文档补充完整 `Result<SendEmailCodeResponse>` 示例、字段单位及错误码；前端可据此使用服务端冷却时间   |
| AUTH-DOC-003 | logout 响应未定义       | V1.1 只声明 endpoint 和 Authorization；`AccountController.logout()` 实际返回 `Result<LogoutResponse>`，其中 `data.success` 为 boolean                                    | 文档补充响应结构、token 已失效时的状态码和幂等语义                                                  |
| AUTH-DOC-004 | Google 登录配置前提缺失 | V1.1 只描述提交 `credential`；源码要求 `app.account.google.enabled=true` 且配置 `clientId`，前端同时需要同一 OAuth Client ID，Google Console 还需配置 Authorized Origins | 文档列出前端、服务端和 Google Console 三处配置及 audience 一致性要求，并定义未启用/配置错误的响应码 |

## 其他文档差异

- V1.1 SSE 指南一处写“seq 未在 data 中显式返回”，实际 `EventPushService.buildEventJson()` 会写入 `seq`；应修正文档。
- `/api/v1/files/upload` 已被前端平台图片分享使用，但未列入 V1.1 产品服务接口文档；应补充 multipart 字段、限制、鉴权与返回结构。
- `GET /api/v1/shares/{token}` 的 `agents` 在 `ShareService.buildDetail()` 中固定为空，也不返回报告正文；前端当前不再注册公开分享页或调用该接口。若后续恢复公开分享，需要定义稳定的 snapshot report schema 并在创建时固化内容。
- `synthesis_completed` 和 `workflow_completed` 都可能发布 `task_complete`。虽然 seq 已递增，仍建议明确终态事件允许重复，要求消费者幂等。

## 前端临时行为

- 未返回七阶段时展示“待服务端阶段状态”，不推算。
- 历史搜索只透传一个 `keyword`，不在已分页结果上做伪全量过滤。
- Task/Report 保留旧裸响应兼容，但 V1.1 默认按 `Result<T>` 解包。
- 绑定失败保留报告访问和重试入口，不重新执行任务。
