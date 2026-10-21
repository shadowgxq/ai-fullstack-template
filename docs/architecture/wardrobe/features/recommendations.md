# 天气与推荐执行

修订：TD-1｜状态：拟建，待人工评审。账号、公共请求约定与客户端状态见 [总览](../overview.md)。本篇拥有天气事实、候选约束、backend→AI 投递与模型调用恢复，适用于 FR-006，不引入推荐反馈、图像识别或自动记录穿着。

## 1. 设计结论与执行边界

backend 组装个人业务上下文，AI Runtime 用一个版本化 `wardrobe.recommend.v1` 工作流选择库存衣物并返回结构化依据。业务结果只写入 backend 推荐资源，衣物及穿着记录始终只由各自业务用例写入。AI 不查业务库、不获取图片、不调用搜索或写工具。

复用异步 Run 比在 backend 同步调用模型多一个投递/对账进程，但能直接使用现有持久队列和 Checkpoint，并让小程序请求时延与模型调用解耦。同步直调的实现更短，却需重建调用恢复与预算，也越过项目现有 backend/AI 边界，因此本范围采用异步方案。仅有真实吞吐证据时重新评估进程数量，当前不实现多 Worker fencing、SSE、人工审批或通用任务平台。

以下机制是接入真实模型的必要增量，不能以当前 echo 测试已通过为替代。AI 公共 Run 状态保留 queued/running/completed/failed，新增 cancelled；`unknown` 只属于 Operation，不成为新的 Run 枚举。业务“无库存/无满足候选”属于正常说明结果，不是模型失败。

## 2. 位置、城市与天气事实

位置适配只在用户触发定位后调用宿主能力；拒绝、取消、失败分别给出可恢复提示并保留手动选城。`CityPort` 提供 `search(query,page,page_size)` 与 `resolve_coordinates(lat,lon)`，返回稳定 city_id、地区层级、展示名、坐标及 IANA 时区。搜索结果由 backend 校验与分页返回，不以自由城市字符串直接拼供应商 URL。

拟议 API：`GET /api/v1/cities?q=&page=&page_size=`；`POST /api/v1/locations/resolve {latitude,longitude}`；`GET /api/v1/weather?city_id=`。均经登录与限流；resolve 不保存精确设备坐标。手动选城通过 profile 的城市设置保存；成功定位所得城市仅作为当前上下文，用户选择保存后才替换已选城市。已有手动选择优先，定位必须由新的用户动作主动覆盖。没有有效位置时天气返回 `status=unavailable, reason=no_location`，衣柜和推荐仍可使用。

`WeatherPort` 返回的规范化事实为 `city_id/region_label/weather_date/timezone/observed_at/fetched_at/condition/temperature_min/temperature_max`，温度用摄氏度、时刻使用带时区时间。供应商缺失的值保留 null。地区天气日期由城市时区决定，穿着记录日期仍由用户时区决定，两者不能混用。

backend 负责验证地区、天气日期及时效；只使用目标地区当日有效数据。初始可用缓存窗为 fetched_at 后 30 分钟且 weather_date 仍为当地当天；过窗数据重新获取，失败时输出 unavailable，不把昨日或过期数据当成今日事实。上游 observed_at 缺失时显示实际获取时间并注明，不伪称供应商更新时间。具体供应商发布时间容忍度要在适配器契约中核对，未核对前不宣称新鲜数据。缓存为可选，坏缓存可回源，认证 Redis 故障仍拒绝。

天气外部请求超时初始 3 秒，不自动重试。失败响应仍为合法的天气缺失 DTO，携带 timeout/provider_error/invalid_data 等安全原因；服务自身不可用才用 503。请求生成推荐时重新核对当前天气有效性；快照中冻结本次事实和缺失原因，缺失天气不发给模型伪默认值。无位置不尝试默认城市，手动选城失败保留原有效设置。

天气服务、城市搜索和地理解析由注入适配器完成；尚无供应商选择和覆盖验证。供应商不可用时不会产生成功天气演示；离线 fixture 只能用于测试环境并明确模式。

## 3. 候选约束与模型契约

### 3.1 过滤及未知值

backend 在一致读快照下读取全部本人可穿衣物、偏好与已确认历史，不从第一页列表取候选。硬约束先执行，再由模型在允许集合内选择：

1. owner 必须是当前用户，status 必须为 wearable。
2. 颜色/风格的明确避免项分别用属性目录的 color_family 和已选 style 标签确定性判定。已知命中避免项即排除；在存在该维度避免项时，未知维度无法证明满足排除要求，也不作为已满足条件的候选。
3. 没有该维度避免项时，未知属性可以参与推荐，必须携带无法判断的说明；不能为了推荐补出颜色、类别或保暖事实。自由备注只作未受信补充文本，不把它用于绕过确定性排除。
4. 喜欢项、常用场合、当次场景、温度适配与近期重复只作排序因素；不把喜欢项变为必填条件，不擅自放宽明确避免项。舒适度自由文本作为偏好说明，不能声称系统已将每句话转换成可验证硬条件。

上述未知处理是本方案对“未知不得当作已满足”的保守实现，需在技术评审中核对。若希望避免项下仍允许未知属性参与，这是产品语义变化，应先回 PRD，不能由执行者暗中改策略。无可穿库存、全部被已知避免项排除、全部因相关属性未知无法核验分别返回原因及可操作建议；不把“缺历史/缺某品类”当作无候选。

### 3.2 冻结输入与有界规模

`RecommendationInputV1` 包含 schema/workflow/policy 版本、context_revision、deadline_at、候选衣物 ID/已填写属性/版本、偏好、已确认历史摘要、当次场景、天气事实或缺失原因、已知限制。不包含 Token、open_id、精确位置、私有媒体路径、用户图片或模型不需要的账号资料。

历史摘要由 backend 确定性生成：累计记录数、最近 30 个用户自然日内各衣物次数及最近日期、最近若干实际组合，附摘要范围与裁剪信息。空历史明确为 0 条已记录，不断言没穿过。库存所有已填写且用于硬过滤的属性均保留；备注按提供方公开长度上限处理，不截断排除条件。

模型 adapter 暴露可验证输入/输出 token 容量。上下文装配使用配置的 token 计数器及安全余量，在调用前拒绝无法装入的快照，返回 `context_too_large` 和重新请求入口，不静默仅取前 N 件或截掉未知说明。本范围不实现未经验证的随机抽样或分批归并排序；若真实衣柜容量使该错误成为正常路径，需要在同一专项补充分批机制后才可宣称推荐范围满足需求。当前容量与成本未知，属于需在模型选择后验证的假设。

### 3.3 结构化输出与依据

输出为可变长 `suggestions[]`，每项含非空且去重 `garment_ids`、结构化选择因素、取舍说明及 `limitations`；不固定必须有上/下装/鞋，也不把只有一件衣物的建议描述成完整搭配。schema 不要求固定套数或组合品类；具体输出容量由显式 token 预算约束，前端按实际数组展示和选择当前组。

模型只返回候选 ID 和受限解释结构。天气值、偏好标签、历史次数及日期由确定性渲染从快照事实填充；缺失信息和不完整品类说明由服务端补充。模型理由引用事实 ID/字段来源，解析层校验引用存在且值一致，拒绝未知衣物、重复 ID、伪造属性/天气/历史或不符合 schema 的输出。自由措辞不作为业务事实，不能替代字段依据校验；仍需离线反例与后续真实模型评估检查 unsupported claims，不能承诺纯 schema 验证能证明自然语言绝无幻觉。

校验失败不返回半可信推荐，不自动发第二个“修复输出”请求；本次 Run failed，用户可重新请求。若以后需要模型修复，也必须纳入明确请求预算和 Ledger，不能由 SDK 隐式重试。

## 4. 业务推荐资源与跨库投递

### 4.1 数据和 API

backend 新增 `recommendations`：id、user_id、request_hash、input_snapshot、context_revision、status、可空 run_id、可空 validated_result/error、created_at、deadline_at、version。新增 `recommendation_jobs`：recommendation_id、派发/对账阶段、next_attempt_at、attempt_count、last_safe_error。二者在创建事务同提交；job 是待办事实，无需 Redis 消息队列。

| 拟议接口 | 语义 |
|---|---|
| `POST /api/v1/recommendations` | 场景、可空当前 city_id、Idempotency-Key；返回 202 及业务 ID/当前快照。客户端不得传任意 owner、候选列表或天气数值 |
| `GET /api/v1/recommendations/{id}` | 当前业务状态及经再次授权校验的结果，不执行工作流、不派发远端调用 |
| `POST /api/v1/recommendations/{id}/cancel` | 幂等取消意图；与发布串行裁定，返回实际终态 |
| `GET /api/v1/recommendations/{id}/replacement-candidates` | 指定 suggestion/slot ID，过滤已在其他 slot 选择的 ID，分页返回本人当前可穿且满足避免条件的库存 |
| `POST /api/v1/recommendations/{id}/validate-selection` | 当前选择 ID 集合及 version；重新授权、状态/排除校验，返回按当前事实重建的依据，不写穿着、不调用模型 |

业务状态为 `queued → running → succeeded | failed | cancelled | stale`；无候选直接 succeeded，结果带 no_candidates 原因，不创建付费 Run。只有 allowed transition 可更新，终态不可被迟到对账覆写。过期或不可恢复任务 failed，错误保留安全代码；Run 存在不等于推荐已发布。

### 4.2 创建与派发

1. 创建先查幂等操作，重试直接返回同一资源，不重新抓天气形成不同输入。新请求先在事务外获取天气，在事务内锁账号 revision、读取衣物/偏好/历史和保存快照；若期间城市设置变化则重新核对本次 city_id，不能把别处天气绑定当前城市。
2. 同事务写 recommendation、job 与幂等结果后返回 queued。无候选写入明确说明结果，无需入 AI 队列。数据库失败不返回创建成功。
3. 新增 backend 推荐调度 CLI 进程，在业务库的专用连接取得单进程 advisory session lock。短事务取 job、核对状态并持久化 `dispatching` 标记，提交后在事务外 POST AI，传稳定键 `wardrobe:<recommendation_id>` 与冻结输入。dispatching 即使尚无 run_id 也表示远端可能已创建；取消/超时恢复必须核对它。进程连接失效停止推进，不换连接继续提交旧响应。
4. AI 返回 run_id 后短事务绑定。POST 已成功但 backend 未记住 run_id 时，恢复以同一键和同一快照重发，AI 返回原 Run；超时也走此路径，不创建另一 Run。不把调用重试变成新 key。
5. 调度进程周期性读取 AI 快照/结果并回写 running 或终态；读取失败/服务 429/503 按 job 中持久化退避重试，初始 2 秒，倍增至最多 30 秒；不得越过 deadline。非重试性 schema/幂等冲突记录 failed 并留错误证据，不循环发送错误输入。

初始业务 deadline 为创建后 5 分钟，模型调用硬超时不超过 30 秒；均为配置初值，不是已测 SLA。到期将业务标 failed 并登记 AI cancel 待办。任何曾尝试远端创建的 job，即使尚无 run_id，也要以原键核对同一 Run 后取消；AI 在发模型请求前校验冻结 deadline，已过期则不发请求，避免对账创建出迟到的付费任务。队列/模型真实时延不能满足时先调研再修订配置及容量，不通过无限轮询掩盖。

### 4.3 可信用户 scope

新增衣柜 Run 的请求由 Backend 服务 Bearer 认证，另带 `X-User-Scope: wardrobe:user:<id>`，此值由当前已授权 recommendation 的 owner 生成，绝不透传小程序自报 header。AI API 校验调用身份是否具备衣柜 workflow/scope 前缀权限；所有 create/get/result/cancel 路由均使用同一受信 scope 查询。服务级密钥意味着 Backend 是可信调用方，不给客户端。

AI API 将 scope 作为本次 service 上下文，不再对所有衣柜用户复用 `config.scope`。现有 echo 客户端继续使用配置 scope；衣柜 workflow 必须有用户 scope，不能缺失时回退到 echo scope。Run 的幂等唯一域仍为 `(scope,key)`。业务 API 再用 user_id 限制 recommendation，不能仅靠隐藏 run_id 保护资源。

## 5. 取消、库存变化与当前搭配

取消和发布在 backend 同一 recommendation 行锁上裁定。发布先提交则返回 succeeded；取消先提交则状态 cancelled，并把远端取消任务同事务登记，返回取消。取消可以先于 run_id 绑定：保留 job，若远端创建已发生，以原键取得同一 Run 后取消，不能简单删 job 丢弃孤立任务。未发起远端请求的 queued job 可直接停止。

AI 新增幂等 `POST /api/v1/runs/{id}/cancel`：锁 Run 行，queued/running 转 cancelled、写事件并删执行命令同事务；若已 completed/failed 则返回既有终态。Worker 在模型请求前和最终发布前检查取消；外部调用已在途时未必能停止消费，迟到响应只记 Ledger，不覆盖 cancelled，不形成穿着记录。UI 停止轮询不代表取消成功，必须读实际取消结果。

AI completed 后，backend 在发布事务锁账号 revision 和 recommendation：revision 与输入一致才接收；不一致标 stale，并明确库存/偏好/历史或设置已变化，允许重新请求。新请求不覆盖旧快照。该方案保守地使无关单件变更也失效，代价是偶尔多一次用户重试，换取易验证一致性。

每次读取已成功推荐仍校验当前 revision，变化后以 `result_validity=stale` 隐去当前可用搭配并提示重新请求；持久执行状态仍为 succeeded，不通过 GET 覆写终态。生成期间校验失效才将执行状态定为 stale。发布校验通过不保证之后永远可穿；单品替换/确认表单提交仍走各自当前权限检查。

“换一套”是新的业务请求/幂等键，旧 pending 请求先取消或标记不再是当前请求；客户端 generation 保证旧成功结果不覆盖新请求。模型可用事实未变时可能选择同一组，不通过编造新衣物制造差异，解释库存约束。

替换单品在客户端当前搭配内即时更新对应 slot；候选接口允许从全部符合条件的可穿库存选择，不把示例“下装”变成所有库存必须有类别的硬约束。同一 garment 不能占两个 slot，其他选择保持。替换后调用 validate-selection 更新事实及限制说明，模型旧理由不原样套到新组合；失败保留原有效搭配并提示刷新。进入记录表单只复制用户已确认的当前 ID，最终保存遵循穿着专项，历史不会由推荐派发/取消产生。

## 6. AI Workflow、调用账本与预算

### 6.1 实现落点与数据

在 `ai_service.api.schemas` 增加版本化判别 DTO，`RunView.input/output` 按 workflow 区分 echo 与 wardrobe，不把所有字段改为任意 dict。RunService、输入 hash 和 Store 类型接纳校验后的嵌套 JSON，仍用规范化 JSON（拒绝 NaN）及 workflow 版本计算 hash；不能继续假设所有 input 值都是 str。`bootstrap.create_runner` 注册衣柜 workflow，保持 echo 输入、结果和旧 Checkpoint 可恢复。新 SQL 迁移追加 Ledger/预算表和 cancelled 状态约束；更新公开事件、生成契约及 smoke 消费者枚举。

`ModelPort` 接收已冻结的结构化请求，返回原始响应引用、解析输出、供应商 request ID 及已知 usage。`Operation` 唯一 `(run_id, logical_operation, input_version)`，含 payload_hash、attempt、state、reservation、response_ref、provider_request_id。完整响应保存在 AI 私有数据库响应表，输入/原始结果不写公开事件或日志；暂不新增通用 Artifact 服务。公开 API 仅返回验证后的 DTO。

V1 每个 Run 最多一次模型请求；禁用 SDK、HTTP、LangGraph 和结构化修复的自动请求重试。真实调用需配置 model/adapter/prompt/policy 版本、输入输出 token 上限、超时、单次及部署日预算。预算计数至少包含请求数和 token 上限，费用上限只有可靠价格配置时才可计算；价格/usage 未知保留 unknown，不能记为零。默认额度为零，缺凭证或预算不发请求，返回明确服务配置不可用。

### 6.2 节点与提交边界

工作流为 `validate_input → prepare_operation → call_model → validate_result → completion_gate`，使用固定 `thread_id=run_id` 与显式 `durability="sync"`。prepare 固定逻辑操作 ID、payload hash 和版本，返回后确认其 Checkpoint 提交，call 才可开始。官方 [Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers) 描述了同步持久化；具体锁和事务约束继续遵守项目 [Checkpoint 规则](../../../engineering/ai-service/standards/checkpoint-and-effects.md)。

`call_model` 的过程：

1. 检查 Run 仍 running、冻结 deadline 未过、Worker 锁连接有效；若 Ledger 已有匹配成功响应直接复用。
2. 在短事务创建唯一 attempt 并锁定 Run/部署预算行，校验请求数和 token/费用上界，原子预留，状态 prepared，提交。重复执行不会重复预留。
3. 在第二个短事务把 prepared 标为 sending 并提交，再在事务外发请求。sending 表示可能已发送；即便崩溃恰好发生在提交后、发送前，也保守归 unknown，不能凭猜测重发。
4. 完整响应到达后先通过同一 Worker 授权连接持久化响应及已知 usage，Ledger 标 succeeded 并结算预算，然后才向 graph 返回 response_ref。解析失败仍保存调用事实与 usage，再使 Run failed，不通过再次调用修复。
5. completion_gate 检查输出 schema、候选 ID、约束和引用后，调用 Store 的合法条件更新，将结果、状态、终态事件和命令删除同事务提交。failed/cancelled 不覆盖成 completed。

Worker 会话锁、Saver 和应用写入继续使用同一连接。外部网络不占数据库事务；连接丢失后旧执行者不能用新连接保存响应或推进 graph，新 Worker 根据持久状态恢复。原始响应过大须按配置限额接收并标失败，不无界写库。

### 6.3 中断、失败和预算恢复

| 持久证据/中断位置 | 恢复动作 | 公开结果 |
|---|---|---|
| 尚无 Checkpoint | 使用冻结输入开始，同一 Run，不新建 thread | queued/running |
| prepare Checkpoint 已存，Ledger 无 attempt | 先检查版本、取消和预算，再原子预留 | running |
| prepared，尚未提交 sending | 能证明未进入发送区；继续同一 attempt，不能再次预留 | running |
| sending，但无持久响应，包括超时/断连 | 标 Ledger unknown，保留预留预算；Run failed，error `operation_unknown`，不自动重发 | 明确失败，可由用户新请求 |
| 响应已存，graph 尚未 Checkpoint | 复用 response_ref，校验后继续；取消则只保留 Ledger | completed/failed/cancelled |
| graph 已完成，Run 尚未 finish | 验证冻结输入和输出，再按条件发布一次 | 同一结果 |
| Run 已终态，命令重复到达 | 读取终态，不执行模型；清理重复待办 | 保持终态 |

预算不足时不发外部请求，Run failed。供应商明确返回拒绝时按已知 request/usage 记账，不自动重试。usage 未知的预留不释放，避免把潜在消费重复分配；需独立维护操作凭供应商可核查证据结算，不提供隐式清零或同 Run continue。用户重新请求属于新的预算预留，界面不声称前次绝未收费。

模型不支持结构化输出、返回非法结果、权限/schema/版本不匹配等均 failed；天气缺失、历史空及属性不全是合法输入，不能统一失败。代码升级不得改写冻结 workflow 版本的含义；不兼容旧 Checkpoint 明确失败/阻断并保留证据，不清表重新跑。

## 7. 验证依据与真实集成缺口

| 约束 | 最小后续检查 | 失败证据及处理去向 |
|---|---|---|
| 推荐只用本人可穿库存 | A/B scope 隔离，非可穿/归档/未知 ID 输出，发布时并发归档 | 任一越权或过期结果被接受即失败，修 backend 发布门及 AI gate |
| 未知及避免条件不造事实 | 空属性、空历史、单一上装、命中避免、相关属性未知、自由文本注入的固定样本 | 放宽避免、编造属性或拒绝缺固定品类即失败；语义争议回 PRD |
| 天气按真实地区/日期/时效 | 手动城/定位优先、拒绝定位、昨日/过期缓存、缺 observed_at、跨时区午夜 | 错地区/伪新鲜天气即失败，修适配器与规范化层 |
| 不重复 Run/模型消费 | 派发成功未绑定时崩溃；Checkpoint 前后、预留后、sending 后、响应落库后注入中断 | 重复 Run/预留/模型调用即失败，修幂等键、Ledger 或恢复分支 |
| 取消先胜后不可发布 | 派发前取消、创建未绑定取消、模型在途取消、发布与取消并发 | cancelled 被覆盖或远端待办丢失即失败，修事务及对账 |
| 多设备修改可见 | 生成期间改偏好/衣物/历史；发布后读取时变更；单品替换后依据更新 | 旧 revision 仍展示为有效或旧理由套新单品即失败 |
| 未指定供应商不伪成功 | 零预算、缺凭证、超容量、schema 错误、模型超时 | 真实调用被发出或返回假成功即失败，修配置边界 |

确定性与 recorded 测试覆盖协议、解析和坏输入；真实 PostgreSQL 检查锁、事务、队列与 Checkpoint，SQLite 或仅保存 Checkpoint 文件不能替代。live 还需用户授权、供应商/模型、预算和真实微信/天气环境，并记录模型版本、输入范围、usage 和时效。当前均未运行，不把计划中的检查写成已验证。

生产容量、费用和推荐质量尚无验证结论。模型及天气供应商确认后，应复核接口/输出能力和上述限额，无法满足时修订同一方案；调用恢复语义遵循本篇，不因供应商 SDK 默认行为改变。
