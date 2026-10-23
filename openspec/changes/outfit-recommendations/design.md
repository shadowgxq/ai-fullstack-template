# 穿搭推荐闭环｜实现设计

## Context

动机见[proposal](proposal.md)，行为见[spec](specs/outfit-recommendations/spec.md)。消费[推荐正式方案](../../../docs/architecture/wardrobe/features/outfit-recommendation.md)§2–7（2026-10-22工作树SHA256 `82b271715691b3efa291094c6d9c945b3df91362888ef0bc0bf9837902b366d8`）、[穿着与统计](../../../docs/architecture/wardrobe/features/wear-history-and-stats.md)§2–4及[天气](../../../docs/architecture/wardrobe/integrations/weather.md)§2。PRD当前SHA `82d73c489fe226b7acb9cb04f69cae8ce02ba687c489815f0d97ae37d1505f64`。M1/M2及wardrobe-ai-runtime均code-verified，实际严格AI DTO和安全错误语义见[唯一契约](../../../docs/contracts/README.md)/生成快照，不重新定义Runtime。

目前Backend无推荐实体、Outbox、dispatcher或AI消费者；已有SQLAlchemy同步事务、账号revision→资源锁序、版本化选项目录、本人天气上下文、幂等穿着保存。小程序已有Page自定义宿主/固定操作与bottomNavigation槽、WeatherPanel/CitySheet、真实衣物/个人/记录页面和共用记录表单；app.config仍为模板原生Tab，需接通实际三主入口。

UI来源为只读 `miniprogram/design/wardrobe.pen`，SHA `98404673fa82e8955f6b07916eb91fa079feed9f27361054c8599450644f8494`，真实core库SHA `82ac8d54e5ef9f4c717a15cf3d1c15fc495eb4df5340528bdee1c1232b5100f6`。消费P9tls/ZHXw9穿搭、Q3U4y场景、AvD3c替换、SKORD空态，以及NLCY6天气和tz4GK/RYACG穿着表单；按[交付记录](../../../miniprogram/design/wardrobe-ui-ux.md#其他业务路径)已有取消/校验状态适配，不新增设计业务。

## Goals / Non-Goals

把现有单一业务数据流接到已冻结AI执行链，完成建议到实际记录；保持跨账号隔离、终态真实性及局部缺失可用。不扩展Web业务、模型平台、自动穿着、固定搭配模板或社交；不改Pen源或公共库，不将真实模型/宿主/视觉待验改成通过。

## Decisions

### 1. 一致读取与可解释候选

RecommendationService拥有事务，Repository只query/flush。创建先重放本人幂等收据，再按账号revision→推荐请求→所需衣物顺序锁定；避免在已成功保存后因history_revision变化拒绝原key重试。读取/冻结期间账号锁与所有现有写入串行，得到库存、偏好、近30个上海自然日候选穿着摘要及三类revision的一致依据。天气上下文直接走已有owner/日期/事实校验，不能在事务中发外部天气或AI请求。

先遍历/查询全部wearable库存并硬过滤，不能调用普通分页列表只取首页。颜色、场合及用户明确风格标签按目录规范化做三值判断；无明确风格资料不能从类别、照片或颜色推断。缺相关避免项时未知属性合法；有相关避免项且无法证明不冲突时排除。comfort_notes不进入硬判断。

对所有合规库存做可复现软排序（明确喜欢项、场景、候选近期已记录次数/最近日期及稳定ID打破平局），再取有界输入范围。Backend初始容量上限16件，保留全库存/合规数并明示candidate_scope_limited；完整偏好和所选候选属性不截断，事实原子按确定性优先级生成且不超过256，整体受AI 512KiB约束。容量属于明确技术策略，不能伪装已覆盖全部合规库存。原子只含已知值，无可引用原子的事实不能由模型凭空声称；六组偏好及comfort原文完整冻结。

空候选仍保存业务请求/幂等结果，分别ready/no_inventory或no_candidates，不投递AI。scene枚举any/work/daily/date，daily承接本次休闲场景；临时场景不写长期偏好。没有可用weather_context时冻结真实missing/not_requested，UI复用天气组件提供已存/默认城市与主动选择，不把天气失败作为独立衣柜/历史的启动前提。

### 2. 请求/Outbox与事务外HTTP

追加业务迁移，新增recommendation_requests（owner+key唯一、原请求hash、冻结输入/revisions/weather、状态/outcome/result/error、ai_run_id、创建/截止时间）和推荐Outbox（request+kind唯一、pending/lease/完成、lease身份/到期及投递信息）。不修改已有迁移checksum或清表。

创建请求与create命令同事务。dispatcher显式独立命令，认领短事务提交后才发HTTP；按实际lease身份/版本裁定回写，重复或过期执行者不能覆盖新映射。稳定AI key为wardrobe:{request_id}，创建远端成功但映射丢失仍以同key恢复同Run；Backend重投递不是新增模型attempt。业务重试/lease/截止期有限，过截止可failed且不因迟到成功复活；必要取消清理保留持久意图，每次HTTP及退避有界，不因总次数上限丢失未知映射。

AI客户端只访问受信服务配置的base URL，使用服务端Bearer与固定wardrobe workflow；有界超时/响应且不重定向，不让客户端指定scope/Run ID/目标。两个服务保持独立包/角色/数据库，Backend不得import ai_service或查询AI表。真实响应校验workflow、run_id、冻结input及结构，错误归一化安全码，不泄露服务凭据或供应商原文。

HTTP执行者与主执行者共享一个冻结Python边界：`AiRuntimeClient(base_url, api_key, timeout_seconds=5, max_response_bytes=1048576)`，方法为 `create_run(key, payload)`、`get_run(run_id, payload)`、`cancel_run(run_id, payload)`、`cancel_by_key(key, payload)`，payload均为期望的冻结AI input；返回验证后的原生Run字典。`AiRuntimeError(code, retryable=False)`仅含安全code和可重投递标志。create固定POST /api/v1/runs与wardrobe版本，get/cancel分别固定相对资源路径并核对请求Run ID；全部比较回包input/版本且拒绝错误身份。类构造不I/O、缺配置在调用前失败；主执行者负责业务状态迁移，HTTP执行者不接触SQL/Outbox/业务鉴权。

取消先持久化业务终态和cancel意图，与ready按请求行竞争。没有远端Run ID或创建投递在途时，以同冻结input/key调用Runtime cancel-by-key，原子取得既有Run或cancelled tombstone而不创建Command；禁止先create再cancel启动不必要的模型。既有create在途按key竞争同一Run，清理保留可恢复关联，不能丢失取消意图。取消outbox幂等，迟到映射/回应只补必要证据，不能恢复cancelled或过期failed。

### 3. 发布、读取和受控说明

查询映射的Run在业务事务外完成，随后重新按账号revision→请求锁序发布；ready和cancelled只允许合法条件写。发布和之后每次ready读取/validate均核对owner、wearable、结构化硬约束、inventory/history/preferences revision及实际使用天气的时效，变化返回stale（input_changed/weather_expired）。天气本来missing不因自然日变化本身失效；历史说明保留实际冻结范围，不能换成新的“今天”事实。

Runtime已做形状/成员校验，Backend仍重验selected IDs、reason_codes、fact_refs的语义。喜欢匹配必须有相应选中衣物与偏好事实，天气/历史原因必须有对应已知证据；任一伪造或不成立的原因以invalid_output失败，不静默发布其保证或付费修复。最终中文reasons/limitations由受控模板构造，不展示模型自由文本；舒适度仅参考、部分搭配、属性/历史/天气缺失和容量限制由事实重算。不能凭天气文字宣称衣物保暖、防水或舒适度已保证。

### 4. 替换与实际穿着的原子边界

replacement-candidates查询当前本人全量合规库存，按稳定游标分页并排除草稿其它已选项；游标绑定owner/request/revisions/排除集合，不强制原类别。validate-selection接受1..64个唯一selected_ids，返回原顺序、该组合受控reasons/limitations和合法衣物视图；允许原模型输入范围外的当前合规衣物，仍重验同一请求依据。不调用模型、不保存选择或穿着，不保留旧组合特有理由。

共用wear表单接受预填选择与可选recommendation_request_id，显式保存才写wear_records。扩展既有WearCreate/持久来源字段及真实调用者：带来源时在同一个保存事务、账号锁下复核该请求与完整组合，防止预填后stale绕过校验；原始幂等收据优先，已成功保存后的同key重试继续返回原收据。手动记录不带来源，继续允许本人归档/暂不可穿衣物和过去日期。来源只作追溯，不在后续历史修改/删除时重跑旧推荐或改历史快照；明确手动补录入口不能成为静默降级。

### 5. 小程序真实状态和导航

UI执行绑定本Change的指定pending tasks，先读取真实源节点/组件/主题并prepare，使用当前例外保留字体strict pin/视觉pending。用现有Page、Button、Notice、StatePanel、PrivatePhoto、WeatherPanel和业务Sheet组合，不从设计示例复制库存/温度/统计值。

请求草稿按账户/会话代次保存稳定创建key与request_id；离开只停轮询，回来查询同请求。生成/换整套使用新key，生成中提供取消、确认禁用；取消中防重，不以本地标志假报服务端成功，ready先胜展示实际结果。退出/切号清理所有推荐缓存/草稿，旧成功/401/取消/校验回包按代次及序号丢弃。

替换即时更新完整选择草稿，保留其它项；校验中隐藏旧理由/禁用确认，失败保留选择并可重试/重选，只有最新请求序号与同会话响应可一起更新组合/说明。确认先完成组合校验再开共用表单，保存带来源并沿现有幂等/草稿机制；成功使历史/统计/单件次数与推荐历史依据失效重取。

衣柜/穿搭/记录使用一个真实三入口导航，个人/设置由既有头部入口承接。替换模板原生Tab配置与受影响switchTab调用，按现有Page bottomNavigation槽实现一致固定导航，避免原生示例Tab与业务导航重叠；辅助示例页面无需无关删除。Light/Dark、390及窄屏、胶囊/安全区/键盘沿现有业务规范，静态通过不冒称实际视觉验收。

## Risks / Trade-offs

- 两库和外部调用不在同一事务 → Outbox、远端稳定幂等、lease条件回写及原子业务终态，故障注入验证每个窗口。
- 保守revision使旧建议失效 → 明确stale并允许新请求；历史记录与手动补录保持独立，不自动重写旧建议。
- 输入容量有限 → 全库存先硬过滤/排序，再明示16件范围与限制；不新增调用次数或丢失避免项。
- 真实模型、微信/定位、媒体持久化及字体/视觉尚待核验 → 隔离代码证据与真实接入/人工验收，不以替身或静态结果替代。

## Migration Plan

现有Backend head为8edcf8789aeb，按此追加推荐/Outbox与可空穿着来源迁移，保留既有资料/天气/衣物/历史及幂等记录。仅在本任务已确认wardrobe_test与独立wardrobe_ai_test、Redis56379/14中验证；两服务HTTP/dispatcher/Run/单Worker/Saver真实接线，只有模型和外部微信/天气提供方使用替身。保留原样非秘密响应供实际小程序decoder复验，不运行浏览器或应用产物构建。协调者导出唯一提供方schema后再生成客户端产物，全部成员/阶段集成及独立审查通过才回写M3代码完成。
