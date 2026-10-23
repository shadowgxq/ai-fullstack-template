# 跨端契约

提供方 Pydantic/路由为 schema 唯一事实源；[generated](generated/) 是提交的 OpenAPI 快照，不手工维护。`make contracts` 导出，`make contracts-check` 校验漂移。语义变化同步本文与直接消费者测试。

| 提供方 | 消费者 | 约定 |
|---|---|---|
| backend | frontend / miniprogram / 测试客户端 | `/api/v1/auth/*`；沿用 `{code,message,data}`；请求 ID 经中间件提供 |
| ai-service | 受信服务 / smoke 客户端 | `/api/v1/runs` 原生 DTO；Bearer token；scope 来自受信配置而非请求 |

AI 创建要求 `Idempotency-Key`（1–128位非空白可打印ASCII）及匹配workflow的严格输入；额外字段被拒绝。`echo.v1` 保留默认workflow与 `{input:{text:"..."}}`，文本1–2000字；`wardrobe.recommend.v1` 使用独立结构化输入，不通过echo文本传库存。输入hash包含workflow版本；同scope、同key、同输入返回原Run当前快照，异输入409。新穿搭Run同时冻结服务端模型/地址/JSON或SSE传输/reasoning参数和prompt/schema资源摘要，重试与恢复不随当前配置改写；凭据不进入冻结描述或Checkpoint。

穿搭输入包含候选衣物的已知属性、六组偏好及comfort_notes、当次scene、近30日历史摘要/范围、天气事实或缺失、三类revisions、目录/策略/prompt/schema版本和可引用事实原子。候选1–256件，历史最多256件、事实原子最多256个，整体最多512KiB；超界拒绝，不静默截断。scene为any/work/daily/date，具体字段和边界以生成schema为准。不得传入图片、私有URL、openid、原始坐标或无关备注。Runtime检查结构与候选/事实引用成员关系；Backend负责本人权限、三值硬过滤、事实语义和发布时最新业务状态，不能以模型选择代替业务授权。

穿搭结果包含 `selected_ids/reason_codes/fact_refs/tradeoff_codes` 与 `call_evidence`。至少选择一件、不重复且必须来自冻结候选；受控code没有舒适度已匹配或效果保证。call_evidence仅含Operation/响应引用、adapter、requested/returned model、供应商request ID、版本及已知usage，未知为null；不公开供应商原始响应、Graph State或内部执行描述。非法结构/引用为invalid_output，不自动调用模型修复。真实模型结构化输出兼容性与usage仍需另行接入验证。

快照包含run_id/workflow/status/input/output/error_code/last_sequence/created_at/cancel_requested。状态为queued→running→completed/failed，或经取消成为cancelled；未完成结果409，跨scope/不存在404。`POST /api/v1/runs/{id}/cancel` 幂等返回快照；取消先胜则cancelled且阻止发布迟到结果，完成/失败先胜则保留该终态。取消不保证已发模型请求可撤回或免费；sending后无持久响应以call_outcome_unknown失败，同Run不自动重发，已有完整持久响应则复用。

未知Run ID的取消使用 `POST /api/v1/runs/cancel-by-key`，沿用CreateRun body与Idempotency-Key，返回200 RunView。它在同scope/key下取消既有Run或直接持久化cancelled Run及事件，不写Command；后续创建重放返回该Run。同key异input409，已完成/失败终态不倒退，调用方无需先创建新任务才能取消。

`GET /api/v1/runs/{id}/events?after=0` 最多100条持久JSON事件，以最后sequence续读、快照校准，当前不是SSE。状态及事件同事务提交；running取消包含cancel_requested与cancelled事件，重复取消不重复添加。AI错误沿用FastAPI `{detail:...}`，验证422、未授权401、数据库不可用503；输入验证只返回loc/type/msg，不回显input/ctx，错误响应安全编码非法Unicode。Bearer及scope来自受信服务配置，调用方不能通过body自报owner/tenant或客户端Run ID绕过Backend业务映射。

## 认证与字段错误

后端 JSON 登录使用 HTTP Bearer。401 返回 Bearer challenge；Redis 限流/撤销读写失败返回 HTTP 503、业务码 50301。缓存不可用仍可回源，不能复用缓存降级策略绕过鉴权。用户名与密码限制见生成 schema；密码另按 UTF-8 最多 72 字节校验。422 信封的 `data` 为 `loc/type/msg` 列表，不含 input/ctx；前端归一化保留为 `ApiError.details`。

## 小程序消费者

`miniprogram/src/shared/api/schema.generated.ts` 由此处 Backend OpenAPI 快照生成，是端内消费产物，不是新的 schema 事实源。修改提供方后依次导出根快照、运行小程序 `contracts`，检查 provider 和直接消费者；CI 的 `contracts:check` 只读比较漂移。

小程序通过 `POST /api/v1/auth/wechat` 提交 `{code}`，取得 `{access_token,token_type,user:{id,username}}`，再以 Bearer 访问本人资源；旧用户名密码接口保留兼容已有账户。微信身份仅由服务端交换确定，不接受客户端 openid 或 owner。`GET /api/v1/profile` 返回本人的 `user_id/nickname/avatar_media_id/city_id/version`，可选资料初始为 null，头像 ID 使用 UUID，version 从1开始；不提供个人时区字段。真实微信配置及宿主体验仍待接入验证。

`PATCH /api/v1/profile` 使用严格正整数 `expected_version`，接收可选 nickname/avatar_media_id/city_id；missing 保持、null 清空，昵称 trim 后空白归 null、最长80字符。头像必须为本人 ready 的 avatar 媒体，城市必须来自可信地区目录；额外字段被拒绝。保存返回完整新版本，旧版本为409；资料与头像引用同事务更新，不增加衣物、历史或偏好 revision。替换/清除后原未引用媒体走现有清理，不能在资料事务中直接删除文件。客户端固定编辑初始版本，结果未知时重新读取核对，不能自动以新版本覆盖并发修改。

`/health` 为无认证的原始状态对象，不套业务信封，也不证明依赖就绪。请求 origin 和传输实现独立于 Web；客户端按账户和会话代次隔离个人请求及缓存，旧成功回包或 401 均不能影响新会话。凭据持久化成功后才进入登录态，退出标记防止残留 token 被恢复；远端撤销失败必须与本地清理结果分别反馈。

## 衣物与私有媒体

所有衣物/媒体归属均来自认证身份，跨账号 ID 返回 404。`GET /api/v1/wardrobe/options` 提供版本化选项；衣物列表按 `(created_at,id)` 降序分页，游标绑定账户与筛选，改变筛选需清除游标。

`POST /api/v1/garments` 要求 `Idempotency-Key`，返回不可变创建收据 `{id,version}`；同键异内容 409，同键同内容重试不重复创建或增加库存 revision。`PATCH /api/v1/garments/{id}` 要求 `expected_version`，missing 保持原值，可空字段显式 null 清空，多选以 [] 清空；status 不接受 null。版本过期返回 409，照片或有效名称至少保留一项。写入与收据/revision 原子提交，衣物不提供普通永久删除。

`POST /api/v1/media` 为认证 multipart（`file`、`purpose=garment|avatar`），同样要求幂等键，成功仅返回 ready 媒体 ID、用途及规范图片元数据。衣物只绑定本人 ready 的 garment 媒体；图片内容经 `GET /api/v1/media/{id}/content` 授权下载，返回 `private, no-store`，不公开存储 key 或公共 URL。上传重试按用途与原文件摘要识别，文件/数据库部分失败可恢复；已清理媒体保留幂等墓碑且不可复活。

## 长期穿搭偏好

`GET/PUT /api/v1/preferences` 读写本人的六组 `liked_styles/avoided_styles/liked_colors/avoided_colors/liked_occasions/avoided_occasions` 与可空 `comfort_notes`。未保存时GET返回version0、空数组/null，不写库；首次完整PUT带expected_version0创建version1，之后按读取版本更新，过期为409。响应包含catalog_version，使用与衣物相同的选项目录，数组规范去重排序；未知项拒绝，同项喜欢/避免交集在对应avoided字段返回422，不自动删除选择。

PUT六组和comfort_notes全部必填，expected_version为严格非负整数，额外字段拒绝；每组最多32个、ID最多40字符，舒适度trim后空白为null、最多500字符。保存与preferences_revision同事务，不改变profile、inventory/history revision或实际穿着。comfort_notes作为原文持久化，产品语义为AI补充参考，不进入硬排除或保证文本要求；风格/颜色/场合的结构化避免项仍为硬约束。读取或保存成功本身不证明推荐已解释、验证或执行该文本。

## 城市与天气

`GET /api/v1/cities?q=&cursor=` 使用本人Bearer身份查询冻结可信目录；q必填、1–80字符，cursor可选、最长2048字符，每页最多20项。返回 `{items,next_cursor,mapping_version}`，地区含稳定city_id/region_id、weather_code、省/市/区县和display_name；同名地区不自动选首项。游标绑定规范查询和目录版本，非法为42272、版本变化为40970；未知城市为42270。

`POST /api/v1/weather/context` 接受可选city_id或 `location {latitude,longitude,coordinate_system:"gcj02",accuracy:"fuzzy"}`，两者互斥；空输入按有效已存城市→默认杭州确定地区。坐标仅供本次逆地址解析，不保存历史；无法唯一核验为42271，地图无配置或不可用为50371。城市保存仍走同一个profile版本接口，天气请求本身不修改profile。

响应 `WeatherContextView` 包含本人context_id、完整region、selection_source（selected/saved/default/location）、weather_date、valid_until、state、facts与missing_reason。facts只含有证据的观测/预报、来源/解析版本及抓取时间；forecast.issued_at、observation.observed_at与fetched_at分开，部分当日预报不补成完整气温范围。available必须有有效事实；来源、缓存或跨日失败返回missing及结构化原因，不能把旧城市事实标为新城市。

上下文止于下一 `Asia/Shanghai` 午夜，服务端消费重验owner与有效期，跨账号40470、过期40973；不提供公开context读取接口。公共天气缓存按规范地区/来源/解析版本/北京时间日共享，历史到缓存日加7天午夜清理，短期失败不缓存全天。认证与撤销Redis故障仍50301，不因天气可选缓存降级绕过。真实来源使用条件、地图Key及微信定位权限另行核验；[专项方案](../architecture/wardrobe/integrations/weather.md)维护来源与日界规则。

## 穿搭推荐

`POST /api/v1/recommendations` 接受 `{scene,weather_context_id?}` 和 `Idempotency-Key`，返回202的业务请求快照。同账户同键同内容返回原请求当前状态，异内容40980；跨账户或不存在40480。客户端只持有业务request_id，AI Run映射由Backend管理。

状态为dispatch_pending/generating/ready/failed/cancelled/stale。快照包含scene、outcome、error_code、inventory_count、eligible_count、candidate_scope_limited、limitations、result、created_at和deadline_at；result为完整selected_ids/garments/reasons/limitations。空库存或无合规候选直接ready并分别返回no_inventory/no_candidates，result为null、无AI投递。Backend扫描全部库存，明确避免项按三值规则排除未知后再确定性排序，AI输入最多16件并披露容量；少量库存可生成局部建议，不要求固定品类。

`GET /recommendations/{request_id}`读取当前结果，`POST /{request_id}/cancel`幂等取消活跃请求；ready先胜则保留ready，cancelled先胜则迟到结果不可发布。业务截止期为创建后5分钟；截止、取消及stale后的远端清理经Outbox继续有界重试，不把截止期等同于远端请求已撤销。库存/历史/偏好revision变化或已使用的available天气过期使推荐stale；missing天气仍可推荐，不虚构天气依据。

`GET /{request_id}/replacement-candidates`接受重复exclude_ids、cursor和page_size（默认20、最多50），返回本人当前合规衣物及next_cursor；不限定原16件或同品类。游标绑定账户、请求、revisions和排除集合。`POST /{request_id}/validate-selection`提交完整selected_ids（1–64件、唯一且保留顺序），返回重新校验的完整组合与受控理由，不调用AI或写穿着。非ready为40981，stale为40982，非法组合/容量42280、非法游标42281。替换不能沿用已不成立的旧理由。

推荐、轮询、取消和调整均不产生穿着。`POST /wear-records`可携带recommendation_request_id；Backend在实际保存的同一事务中重验本人请求、最新依据与完整衣物组合。成功后的同键重放先读取原收据，避免自身history_revision变化使保存重试失败。未携带来源的原手动记录契约和旧幂等收据保持有效；来源只记录出处，后续历史修订不重新套用旧推荐。

## 实际穿着记录

`POST /api/v1/wear-records` 接收 `{wear_date,garment_ids[],recommendation_request_id?}` 和 `Idempotency-Key`，返回不可变 `{id,version}`。日期仅接受 ISO date，按 `Asia/Shanghai` 拒绝未来；本人三种状态衣物均可补录，同件去重后形成同次操作的规范内容。同键异内容 409，收据与记录、明细及 history revision 同事务。

`GET /wear-records`（同一 `/api/v1` 前缀）接受包含边界的 `start_date/end_date`、游标和 page_size；按 `(wear_date,id)` 降序返回 `{items,next_cursor}`，游标绑定账户和日期筛选。详情及列表 items 使用 `name_snapshot/category_snapshot`，不以当前属性重建过去信息。照片不属于历史快照，展示当前照片时仍须通过本人衣物及私有媒体授权链取得。

`PATCH /wear-records/{id}` 带 expected_version，日期/衣物集合 missing 不变，显式 null 或空集合无效；保留项沿用原快照，新增项取当前属性。`DELETE /wear-records/{id}?expected_version=...` 返回 `{id,deleted:true}`；相同删除重试不重复改 revision，删除墓碑使原创建请求重放返回 409，不复活记录。跨账号记录统一按不存在处理。

`GET /garments/{id}` 的 `GarmentDetail.wear_count` 来自有效明细聚合，归档不清零，修正/删除后重新读取反映实际结果。衣物 PATCH 仍返回基础 `GarmentView`；消费者应失效并重取详情，不能用基础响应覆盖含次数的缓存。

## 衣柜与穿着统计

`GET /api/v1/statistics` 在同一 SQL 读快照返回当前衣物总数、归档数、当前类别分布（null为未分类）、全量有效穿搭数、单件次数和近30日趋势。当前库存总数仅含可穿与暂不可穿；归档衣物的历史和次数继续保留。趋势固定 `Asia/Shanghai` 今天及此前29日，明确起止日/时区并补零，不截断全量穿搭数。

`wearable_count`、`unavailable_count` 提供状态筛选需要的本人全量计数，与其余汇总在同一读快照内取得，两者之和等于 `wardrobe_total`。这两个新增展示字段为可选：现有提供方返回实际整数，客户端接受已留存的旧版 HTTP 证据及尚未更新的提供方响应；缺失或 null 时隐藏对应数量，不以当前分页长度或 0 替代。旧字段及分页契约保持不变。

单件 `garment_counts` 包含本人三状态及0次衣物，行返回当前名称/类别，以 `(wear_count,garment_id)` 降序分页。`page_size` 默认20、上限100；`garment_cursor` 签名并绑定账户、统计日与库存/历史 revision，非法或跨账户为422，事实/日期变化使旧游标返回409，客户端清空旧分页并重新载入首屏。每次响应的汇总、趋势和当前单件页来自同一读快照，不混入未确认穿着。
