# 穿搭推荐 Runtime｜实现设计

## Context

范围见[proposal](proposal.md)及[规格](specs/wardrobe-ai-runtime/spec.md)。消费[推荐方案§2/5](../../../docs/architecture/wardrobe/features/outfit-recommendation.md)（2026-10-22工作树SHA256 `82b271715691b3efa291094c6d9c945b3df91362888ef0bc0bf9837902b366d8`）和[总览](../../../docs/architecture/wardrobe/overview.md#2-系统架构)，遵守[Checkpoint与副作用](../../../docs/engineering/ai-service/standards/checkpoint-and-effects.md)与[模型边界](../../../docs/engineering/ai-service/standards/model-and-tools.md)。M1/M2已code-verified，人工待验不阻塞此处无UI的执行契约。

实际代码只有EchoInput、echo.v1注册及单节点图；Store把Run/命令/事件写在短事务，Worker持数据库级session advisory lock，Saver和发布共用同一autocommit psycopg连接。尚无取消、模型接口和Operation表；不能将echo恢复测试当作付费调用恢复。

## Goals / Non-Goals

在一条现有执行链内增加结构化穿搭、取消和最多一次调用证据恢复，使Backend能在后续Change作为真实消费者集成。本项不访问业务数据库、不承担owner/库存硬过滤/最终理由发布；不新增多Worker、工具平台、每日预算系统、SSE或UI，不开展真实模型调用或质量Evals。

## Decisions

### 明确DTO与冻结边界

公开输入在Pydantic层严格区分echo与wardrobe版本，拒绝多余字段与超界输入；Runtime内部使用core中的框架无关协议和纯验证类型，API DTO、Graph State与数据库行分开映射。冻结候选ID/已知属性、偏好六组及comfort_notes、场景、历史摘要/范围、天气事实或缺失、revisions和目录/策略/prompt/schema版本。空历史/偏好、无天气和少量候选合法；不传图片、坐标、openid或无关备注。输入容量明确有界，超界拒绝，不能静默截断或丢硬约束；Backend后续负责全库存过滤与可解释的容量选择。

输出selected_ids、reason_codes、fact_refs、tradeoff_codes和调用证据引用均有严格结构与来源约束；Runtime校验候选/引用成员关系和形状，Backend再验证事实语义与当前业务状态。舒适度文本没有可保证的匹配事实，不产生comfort_matched等保证理由。输入自由文本是数据，不具备指令/工具/权限效力。

### 执行配置与模型适配

新增最小ModelPort及infrastructure适配，版本化prompt/schema作为包内资源加载；静态注册wardrobe.recommend.v1，不从用户输入导入执行器。新Run冻结服务端执行描述（adapter/model、prompt/schema引用及影响请求的有界参数），不存凭证；同Run不可因重启配置变化静默换模型或payload。已有响应恢复不需要重发，也不能依赖当前凭证才读取已存证据。

模型默认未启用，空模型/凭据不影响API、echo与离线自检；穿搭执行在发送前明确失败。真实适配仅按明确配置启用，采用具体供应商支持的结构化输出协议，默认使用OpenAI HTTPS目标；允许运维显式配置受信HTTP/HTTPS的`/v1`网关，地址及JSON/SSE传输/reasoning冻结到Run，当前Key仅发送到与当前配置一致的冻结地址，业务输入不能指定。旧描述保持JSON协议。限制超时、请求/响应与输出容量，不跟随任意重定向。实际参数以一手协议及锁定实现核对，不宣称所有模型兼容。关闭SDK/HTTP/Graph及输出修复重试；每Run最大调用数为1，未知usage保持null，不实现价格推算或每日金额平台。测试注入纯替身或HTTP边界替身，未获真实调用授权。

### prepare→invoke→validate与Operation

prepare计算并冻结标准请求、模型/prompt/schema版本和稳定Operation标识；必须先返回并以durability=sync提交Checkpoint。invoke进入前通过同一持锁连接的短事务登记sending和单次调用额度，再在事务外调用ModelPort。一次Operation对应一Run的一次请求，唯一约束防重复，避免增加无需求的多attempt双表。

完整供应商响应、response_ref、requested/returned model、已知request ID/usage及安全错误持久化后，才把response_ref送入后续Checkpoint。响应存受控AI数据库，不进入日志/公开Run DTO。恢复首先核对Operation与输入/执行描述摘要：已响应复用；sending无响应→unknown并失败，不重复调用；尚未发送且证据一致才可继续。validate本地校验结构、候选与引用，非法输出invalid_output，不自动修复。返回结果包含安全调用证据引用，供Backend记录，不能当作业务验收证明。

### 取消、终态与同连接授权

新增同scope `POST /api/v1/runs/{id}/cancel`，返回Run快照。Store在短事务锁Run裁定取消与完成，queued可直接cancelled，running持久取消意图并阻止新调用；发送中的请求不承诺免收费或可撤回。Worker检查取消，在最终发布时再原子复核；取消先胜不发布成功，完成先胜保留completed。事件与对应状态同事务递增sequence，重复取消不重复终态事件；内部原始响应可保留但不复活Run。

继续使用数据库级单Worker会话锁、同连接Saver和Operation/Run写入，禁止旧Worker失锁后换连接提交。网络期间无长期事务。新增代码不能将全部异常都变成可重试；连接异常停止旧执行者，恢复决策依持久Operation而非内存标志。

### 既有echo与迁移

保留实际验证依赖的echo.v1 HTTP字段、注册与旧Checkpoint输入/节点语义，不建立第二套调用入口。追加版本化SQL增加cancel/Operation/执行描述所需字段和约束，绝不修改0001 checksum或清空表。已有echo无模型描述可按原版本恢复，新wardrobe有必需描述。同步Store/RunStore/RunService、API、Worker、注册和离线诊断的实际调用者，移除被替代局部逻辑，不以可选fallback掩盖缺装配。

## Risks / Trade-offs

- 发送后崩溃无法确认费用 → 保留unknown且不重发；用户可另建请求，同次不自动恢复成功。
- 取消无法撤回已发网络请求 → 原子终态保护、保留迟到响应证据，不承诺免费取消。
- 结构化输出兼容性未实测 → 具体adapter协议的边界回归与本地校验，真实模型/usage另列pending。
- 包内prompt/schema或State升级 → 冻结版本/摘要与旧echo真实Checkpoint回归，不改旧版本节点或偷偷清状态。

## Migration Plan

只在本任务所属55432集群另建独立AI测试数据库/角色（库名以_test结尾），与Backend数据库隔离；应用迁移及Saver setup继续显式分开，保留旧SQLchecksum/echo数据。用真实PG/单Worker/Saver与故障注入验证发送前后、响应后、取消竞争、失锁和独立CLI恢复；不在请求或import时迁移，不触碰业务库。包资源以实际安装/资源读取检查证明，不运行被禁止的build。正式部署和真实模型接入另行处理。

### 未知Run身份的取消补充

Backend投递创建响应可能丢失。受信POST /api/v1/runs/cancel-by-key接受原CreateRun body及同Idempotency-Key，在一个事务中取消同scope/key既有Run，或直接创建cancelled/tombstone及事件且不写Command。同key异input409，终态不倒退；之后create重放取回相同已取消Run，避免取消清理先新建任务触发模型。该边界与既有按ID取消共用锁内终态裁定，不增加另一执行链。
