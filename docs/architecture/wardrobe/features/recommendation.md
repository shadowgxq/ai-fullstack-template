# 推荐、天气与持久执行

状态：R6，沿用已确定模型、中国天气网 HTTP 及日缓存方向；调用结果不明不自动重发，单 Worker，不建设费用预算管理，目标设计。依据 FR-003/006、BR-001/003～006；共享边界见 [总览](../overview.md)，业务事实与 revisions 见 [数据专项](inventory-and-history.md)。

## 决策与职责

推荐只产生建议。Backend 持有本人可穿库存和约束，构建最小输入；AI 持有冻结的 Run 输入、模型调用账本与结果，不能写衣物/穿着。小程序持有当前场景及可编辑搭配草稿，用户确认后才调用穿着保存。

同步 Backend 直接调模型也能产生一次建议，但要另做超时后查询与离页恢复，且复用不了已存在的 Run 队列。选择现有 Runtime 的 JSON 轮询，承担 Backend/AI 两库投递与账本成本；保持单 Worker，不引入 Redis 队列、客户端 SSE、多 Agent 或由推荐模型自主调工具。模型供应商 HTTP 响应可使用 SSE，与客户端 JSON 轮询无关。V1 固定单 Worker，不增加容量评审或多 Worker 扩容任务。

## 位置与天气

天气获取、中国天气网 HTTP 与微信模糊定位映射、杭州样本、来源使用条件、UTC+8 与 Redis 缓存契约见[天气专项](weather.md)。Backend `WeatherPort` 统一解析地区并取得有来源证据的天气上下文；不接 MCP，不由穿搭模型自主搜索。

天气默认杭州 `101210101`，用户有效选择或已保存城市优先；同一地区按 UTC+8 自然日共享缓存，默认当天复用，历史缓存保留 7 天后清理。观测和当天预报分别保留来源时间，日缓存不宣称实时刷新；推荐读取时校验 context_id 归属、日期及 valid_until。天气缺失不阻塞推荐，不以昨日缓存或无证据搜索文本补齐天气事实。

## 硬约束、未知与输入快照

1. 在业务库一致读中取当前 user 的 wearable 衣物、当前保存偏好、最近 30 个自然日的已确认穿着摘要及 revisions；历史窗口作为排序上下文，输出明确范围，不声称拥有全部真实穿着史。
2. 衣物属性转为三值判断：满足/冲突/未知。明确避免项必须可判定无冲突才进入候选；例如避免红色而主色未知，不能声称满足排除条件。涉及风格等派生关系只能使用版本化可证明映射；无映射保持未知。未设置相关避免项时，不完整属性仍可推荐，不要求补齐全档案。
3. 喜欢项、天气及近期重复只参与排序。未知对排序不给“已匹配”加分，理由明确缺失。无可穿库存返回 no_inventory；有库存但无可证明满足排除的候选返回 no_candidates，说明哪些排除项或未知信息阻碍判断，不自动放宽条件。
4. 输入冻结：候选 ID、已填写属性、支持的事实引用、偏好、历史摘要和范围、天气上下文、当次场景、revisions，以及 workflow/policy/prompt/schema/catalog 版本。只送最小结构化信息；不送 openid、头像、图片二进制/URL、精确坐标或原始备注等无关个人数据。名称和自定义文本视为不可信数据。

不固定输出套数/品类，模型可返回候选子集，至少一件，不可重复；只有上装也可输出局部建议。不得静默截断衣柜并宣称使用了全部候选。先按硬条件全量过滤，超出模型输入容量时按确定性软排序分批覆盖候选并选择受控短名单，在结果标明输入选择范围；排序必须记录规则版本，排除约束完整保留。分批仅在 Backend 本地做，不为每批发一次模型请求。具体 token 上限由选定 adapter 校验，配置不足返回 capacity_limit，不发无界请求。

## 模型接入基线

沿用 `/home/gxq/learnSpace/PricePilot` 当前本地配置的 `OPENAI_MODEL=gpt-6.1-sol` 与 `OPENAI_BASE_URL` 所指模型网关；核对依据为该项目 `.env` 的非敏感配置、`ai-service/src/ai_service/config.py` 和 `infrastructure/research_model.py`。该路径仅为本次选型依据，本项目部署不读取或依赖另一个仓库目录。

PricePilot 当前传输为 `responses-sse.v1`，实现使用 Responses API，关闭 SDK 隐式重试。衣柜模型 adapter 沿用连接与传输方式，完整接收供应商终态后保存 response_ref，再按本项目 schema 校验；连接中断仍遵循下文 unknown 策略。只复用模型接入方式，不复制证券研究 workflow、工具循环或默认的大输出额度/长超时。本项目独立配置凭证、输入/输出 token 上限及超时，不在文档、客户端或日志写入密钥，也不在运行时读取 PricePilot 的 `.env`。

PricePilot 的能力验证标记不能作为本项目结构化推荐已验证的证据。接入时仍需核验该网关的 schema/输出兼容性、终态、usage 与超时行为；模型名称和接入方向已确认，不再列为供应商待选。

## 模型输出与事实检查

新增 `wardrobe.recommend.v1`，AI API 的输入/输出使用按 workflow 判别的 DTO；保留 echo.v1 的兼容 schema，不能把所有 workflow 放宽成任意 dict。RunView/result 返回对应版本输出；schema 变更同步根生成快照及 Backend client。application 输入类型由 `dict[str,str]` 扩展为已验证结构化数据，不绕过校验。

模型端口只接收冻结输入，返回 `selected_ids`、受限的 `reason_codes`、`fact_refs`、`tradeoff_codes` 和 usage/response_ref。供应商自由文本可仅留私有审计，不直接作为用户事实展示。Backend 用本地模板把有效事实引用渲染成理由：天气来自 weather context，偏好来自保存值，近期重复来自记录摘要；“材质保暖”等无字段证据的描述不允许渲染。未知信息由 Backend 生成 limitations；局部组合明确“基于现有衣物的建议”，不称完整搭配。

AI 在 schema 校验后检查 IDs 是非空唯一候选子集，原因码/引用都有效；Backend 发布和读取时再次检查本人归属、wearable、当前排除项与 revisions。无效模型输出本次失败 invalid_output，不自动追加“修复”调用，不以随机衣物冒充 AI 成功。软偏好无强制匹配，不承诺准确率。

## Backend 请求与跨库投递

拟议 `recommendation_requests`：id、owner_id、idempotency_key/hash、frozen_input、revisions、ai_run_id、status、result/error_code、created_at。status 为 dispatch_pending/generating/ready/failed/cancelled/stale；并以 outbox 行保证需投递的请求可恢复。客户端 API：

Backend 幂等 hash 只绑定规范化的客户端请求（scene、weather_context_id），先查既有 key 再构建快照；同键重试返回原 request，不能因库存已变化而重建 frozen_input。AI Run hash 则绑定完整冻结输入和 workflow 版本。新一次“换一套”才用新 key 并读取最新快照；库存有限时不能保证内容一定不同，返回实际理由，不伪造新衣物。

| API | 语义 |
|---|---|
| `POST /api/v1/recommendations` | 输入 scene 和 weather_context_id，必填 Idempotency-Key；先存冻结输入/请求/outbox 同事务，返回 202 与 request_id |
| `GET /api/v1/recommendations/{id}` | 先 owner 鉴权，查询/同步 Runtime 结果并返回业务状态；ready 前校验硬约束与 revisions |
| `POST /api/v1/recommendations/{id}/cancel` | 以 Backend 行锁和发布竞争，设置取消意图；ready 已先发布时不倒退，返回已完成状态 |
| `POST /api/v1/recommendations/{id}/validate-selection` | 输入当前草稿 selected_ids；按本人库存和当前硬约束校验，返回规范化衣物与适用依据，不保存穿着事实 |

outbox 由 Backend 显式轮询进程消费，不依赖一次性内存 BackgroundTask；初期单 dispatcher，短事务认领带到期 lease，网络在事务外。创建 AI Run 使用稳定 `wardrobe:{request_id}` 幂等键和冻结输入，AI 沿用受信部署 scope。发送成功但本地映射写失败时，lease 到期后同键重试得到同 Run，不新建付费任务；不同 payload 冲突是内部错误需停止处理。Backend 只向经本地 owner 映射确定的 Run 读写，外部不接收任意 ai_run_id。

创建 AI Run 的网络失败可以有限重投，因为 Run 创建有幂等；供应商调用重试另受账本约束，二者不能混淆。到配置的投递截止时间仍未确认则 Backend 标 failed，持久化取消投递意图；迟到的创建响应也不能发布业务结果。Runtime 暂不可用时 GET 返回生成中/依赖不可用说明，客户端可继续查询，不用空推荐遮盖错误。

Backend 按 owner 保持一个活动生成，同键重试返回同一请求；用户“换一套”可替代并取消旧请求。用户退出不改变已有资源归属，新会话仍需本人鉴权才能查询任务。

## 库存变化与结果有效性

例如用户开始生成后离开穿搭页，把候选衣物归档或设为 unavailable，旧输入中的衣物仍可能出现在模型结果里；修改避免项也可能使旧推荐不再符合当前要求。校验发生在结果发布、读取和确认消费时，不需要持续监听或增加 Worker。

现方案通过 revision 比较使生成依据与结果保持一致：任何库存、偏好或历史修订都使旧结果失效，这是保守的一致性策略。它也会让“新增另一件衣物”等不直接影响已选组合的修改触发重新生成；这是当前技术方案采用的一致性边界，并非库存会自动变化；只有用户主动修改或另一会话提交修改时才触发。V1 沿用此策略，校验不增加持续同步任务。

AI 的 ready 输入在业务冻结后才发送；用户修改库存、偏好、历史使 revision 改变时，发布前标 stale，提示重新请求。已经 ready 的结果再读取也做重核；客户端显示后由用户替换/确认时另校验，不依赖缓存。为避免旧响应覆盖“换一套”，客户端持有当前 request_id/代次，只有匹配者可更新当前草稿。

发布事务遵循数据专项相同的锁序：先锁账号 revision，再锁 recommendation_request，核对冻结 revisions 与当前值后写 ready；客户端读取 ready 也在一致快照中校验。候选校验和穿着确认必须重新读当前有效值，不能将一个较早 GET 当作之后写入的授权。取消只锁请求行且不反向申请 revision 锁，避免形成死锁环。

## Worker、Operation 与调用恢复

复用现有锁、短事务、同连接 Saver 和 sync durability；新增 workflow 的 prepare → invoke → validate 节点。网络不在数据库事务中，也不在 prepare 返回前发出。新增拟议 AI 表：

- `model_operations`：稳定 `(run_id,node_id,input_version)` 唯一、payload_hash、adapter/model/prompt/schema 版本、state、response_ref、error。
- `model_attempts`：operation_id、attempt_no、发送状态、provider_request_id、响应引用、实际 usage（未知保留 NULL）、时间与安全错误。

每 Run 最多一次模型调用，关闭 SDK、LangGraph 节点及结构化输出包装的隐式重试。V1 不建立费用预算、余额预留、每日额度及金额结算机制；启用真实调用需配置模型凭证、模型协议输入/输出上限及请求超时。默认离线不发真实请求，通过显式运行配置启用真实调用。记录供应商实际 usage（缺失保留未知）用于排障，不作为预算放行条件。用户主动重试才创建新 Run。

| 中断位置/证据 | 恢复动作 |
|---|---|
| prepare checkpoint 未完成 | 还未允许发调用，重新准备同 Operation；冻结输入不匹配拒绝恢复 |
| prepare 已保存、尚无 sending attempt | 校验取消，登记 attempt；事务提交后才允许发出 |
| attempt 已登记 sending，但没有持久响应 | 可能已发出，包括登记后尚未真正发送的模糊窗口；置 unknown，不自动重复请求 |
| 响应已持久化，但 invoke checkpoint 未保存 | 按 operation/payload hash 取 response_ref 并解析，零新增模型请求 |
| 图已完成、Run finish 未提交 | 从同 run_id checkpoint 读取最终结果；finish 的终态条件保护避免重复发布 |
| 连接丢失但外部响应迟到 | 旧执行者无写入权立即停止；重启按上述证据处理，不能新连 Saver 接着写 |

unknown 作为 Operation 状态，Run 对用户终结为 failed/call_outcome_unknown，移出待执行队列避免阻塞其他任务；不加一个假 running 无限等待。后续取得供应商回执时只补充调用状态与证据，不覆盖已失败 Run。供应商以后若支持可验证幂等/查询，只在 adapter 证明其语义后复用相同调用身份对账；不把 HTTP 超时当作未计费。私有响应持久化成功才标 succeeded；写盘失败按未知结果处理。

为保持调用证据和 Worker 权限一致，账本/response_ref 元数据通过持锁连接写；原始响应放私有 AI 存储或受限数据库，限制容量与访问，不经公共 RunView 暴露。响应引用与 usage 同短事务登记，再返回 workflow 供 checkpoint 保存。若实际 adapter 响应超过容量上限，保留安全错误及已知 usage，不继续自动调用。

## 取消与发布竞争

小程序取消不等同于取消 HTTP task。Backend 先持久化 cancelled，再由 outbox 用幂等命令通知 Runtime。Runtime 新增受信 `POST /api/v1/runs/{id}/cancel`，scope 过滤，持久 cancel_requested；完成/失败后不反转。

Worker 认领、发模型前、最终 finish 前检查取消意图。未发调用直接以 failed/cancelled 终结；已发调用不承诺供应商能撤回，保存迟到响应与实际 usage，但不再发布 output。Runtime 的 finish 在同事务锁 Run 并检查取消标记，避免“检查完取消后仍写 completed”的竞态。公共 Run 状态仍 queued/running/completed/failed，通过 error_code=cancelled 区分，Backend 映射成 cancelled。

Backend 取消和 ready 发布竞争同一请求行：取消先提交则任何 AI 迟到结果均不可置 ready；ready 先提交则取消返回已完成事实。两库无法原子取消远端执行，但业务结果不会从 cancelled 复活。页面隐藏只暂停轮询，不自动取消；用户明确取消或被新请求替代时可发取消命令。任何路径都不写 wear_records。

## 单品替换与实际穿着消费

`GET /api/v1/recommendations/{id}/replacement-candidates` 根据当前有效硬约束和本人 wearable 库存分页返回，不强制相同类别；用户主动选中的候选通过 Backend 校验接口后回填草稿，其余 ID 保留。不能把当前已选的另一件再次加入。替换不重新调用模型、不改长期偏好、不写历史；原组合理由只适用于原组合，替换后保留天气/偏好等事实依据并显示已手动调整，不继续声称原模型理由解释新组合。

确认实际穿着打开共用记录表单，允许调整日期和衣物，调用数据专项的 POST/PATCH。推荐生成后衣物归档使其不能再当有效推荐确认；提示核对。若用户确实要记录过去穿着，走手动历史选择路径，可选本人归档衣物，不放宽推荐候选规则。

## 验证依据与适配接入条件

后续离线 fixtures 覆盖：只有上装、属性全未知、历史/偏好空、明确排除且未知、无候选、天气超时/跨日、模型越权 ID、重复 ID、无证据事实引用、库存修订变化、替换保留其他项以及场景不写长期偏好。每个例子断言数据库衣物/穿着未被推荐写入。

真实隔离 PostgreSQL 中注入：Backend 提交后 dispatcher 未发送、AI 已建 Run 本地未存映射、账本 sending 后进程中断、响应已存 checkpoint 未存、finish 前后重启、取消/发布并发。核对同 request_id 只有一个 Run、同 Operation 不盲重发、终态不覆盖、取消不复活。失败返回相关机制修复，不增加不受控重试。

实际接入时必须核对：微信 code 交换错误/超时、天气来源及城市映射、中国天气网 HTTP 的地区和日期证据、模型结构化输出是否会额外调用及 usage/幂等能力、私有响应存储权限、真实调用超时与 usage 记录。天气 fixtures 还覆盖来源缺失、地区冲突、跨日旧页面、无更新时间、仅高低温、抓取失败及网页不可信指令；不满足证据要求时返回缺失。默认离线数据不能写成真实集成通过；live 需明确配置与授权。V1 不要求容量评估，不承诺未验证的延迟指标。
