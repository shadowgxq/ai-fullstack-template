# 衣柜、媒体、穿着与统计

修订：TD-1｜状态：拟建，待人工评审。共享边界、身份、版本/幂等与需求覆盖见 [总览](../overview.md)。本篇由 backend 业务层及小程序功能层共同消费。

## 1. 数据归属与事务顺序

backend PostgreSQL 拥有以下事实。每个业务实体保留 owner、创建/修改时间，字段精确长度在提供方 schema 中定义，不从设计示例数值推断产品限制。

| 实体 | 关键数据及约束 |
|---|---|
| `garments` | id、user_id、可空 name/category_id/primary_color_id/photo_media_id、季节/场合集合、可空温度范围/正式程度、标签集合、可空备注、status、version；照片或 trim 后名称至少一项 |
| `media_assets` | id、user_id、purpose（garment/avatar）、storage_key、sha256、验证后 MIME/字节数、状态及创建时间；不暴露磁盘路径 |
| `wear_records` | id、user_id、wear_date、timezone_at_save、可空 source_recommendation_id、version；一条记录至少一件衣物 |
| `wear_record_items` | record_id、garment_id、user_id、name_snapshot、category_snapshot；唯一 `(record_id, garment_id)` |
| `idempotency_operations` | user_id、operation、key、payload_hash、resource_id、完成/删除结果；唯一域见总览 |
| `wardrobe_context_revisions` | user_id 主键及单调 revision，所有影响推荐的写入同步递增 |

`wear_record_items` 用 `(user_id, garment_id)` 和 `(user_id, record_id)` 复合外键引用对应 owner 唯一键，防止跨账号关联。衣物不提供永久删除；删除误记录时级联删除 item，保留幂等墓碑，不删除 garment 或 media。归档仍可回查详情。

所有上下文业务写入按固定次序锁定：账号 revision → 幂等操作 → 目标资源及关联衣物按 ID 排序 → 媒体按 ID 排序。读取保存前的当前版本、执行权限/业务校验、写实体与关联、递增 revision、登记幂等结果同事务提交；repository 只 flush/query。唯一竞争触发 rollback 后核对已提交幂等结果，不能吞掉其他 IntegrityError。

照片或名称约束先由 service 检查媒体归属、用途及 ready 状态，再由数据库 CHECK 兜底非空字段组合。单凭提供 `photo_media_id` 不能通过照片验证。创建默认 `wearable`；状态枚举为 `wearable/unavailable/archived`，展示映射可穿/暂不可穿/已归档，恢复显式选择目标状态，不猜原状态。

## 2. 衣物与属性

属性目录由 backend 只读 `GET /api/v1/wardrobe/options` 提供稳定 ID、中文标签、属性域及可选语义映射；目录带版本，现有历史快照不依赖目录当前标签。设计中列出的类别、颜色、季节和场合可作为首批目录来源，但数量不是封闭产品承诺。自定义标签以文本保存并在当前衣物内 trim、去重，不创建跨用户全局标签；任意备注/名称/标签文本不能成为系统指令。

名称缺失保存 null，图片衣物可用“未命名衣物”作 UI 展示，不把该占位写成用户事实；类别/颜色缺失为 null，季节/场合无选择为空集合，均表示未知，不等于适合所有条件。更多属性折叠仅改变视图；未变字段更新不得因未挂载控件而清空。

偏好风格的确定性匹配采用目录中明确标注 `style_id` 的已选标签；用户自由标签、图片和名称不自动推断风格，避免扩大 V1 到自动识别。选择了风格标签才获得对应已知事实；无映射视为风格未知。主要颜色通过目录 `color_family` 映射类似“荧光色”的排除组，未登记映射不得假定满足。判定的真值规则由 [推荐专项 §3](recommendations.md#3-候选约束与模型契约) 拥有。

衣柜筛选支持状态、类别、主要颜色、季节、场合、标签等已填写属性；同一维度多选为 OR，不同维度 AND。未知值不匹配具体值，未分类作为显式过滤项。衣柜默认可查看非归档衣物，归档筛选单独展示；小程序显示筛选条件，不能把默认列表计数当作总库存数量。

| 拟议 API（统一 `/api/v1`） | 输入/输出和行为 |
|---|---|
| `GET /garments` | filters、q、page/page_size；默认 created_at DESC、id DESC，分页包含状态及必要展示属性 |
| `POST /garments` | 属性及可空已上传 media ID，Idempotency-Key；返回保存实体及 version |
| `GET /garments/{id}` | 当前属性、状态及当前已记录穿着次数；无权/不存在 404 |
| `PATCH /garments/{id}` | 显式更新字段；null 清除单值、空集合清除多值；If-Match；整体验证照片/名称规则 |
| `PATCH /garments/{id}/status` | 目标三态之一、If-Match；归档不删除历史；响应新 version |

不提供 DELETE garment 路由。重复录入允许，内容 hash 仅用于同次请求防重，不能按相同衣物内容去重不同创建键。

## 3. 私有媒体生命周期

### 上传、绑定与读取

选择与上传分开。平台适配 `chooseImage(source)` 明确 camera/album，取消保持原图；选择成功取得临时路径后，使用 `Taro.uploadFile` 向受信 backend `POST /api/v1/media` 上传，带 Bearer、purpose 和幂等键。相册、拍照、头像填写只提供本地候选，不代表已经保存。上传返回业务信封中的 media ID，只有 `ready` 才能作为照片满足衣物校验。

`MediaStore` 只提供 put/read/remove 三个必要方法，默认开发实现为私有持久目录及随机 storage_key；生产可替换为私有对象存储，二者均不开放静态目录或公开 URL。目录位置是服务端部署配置，不存入 DTO；所有路径由服务端生成，不能使用上传文件名拼路径。单文件初始技术上限 10 MiB，超限 413 并明确提示；JPEG/PNG/WebP 需实际解码、校验像素上限并重新编码清理 EXIF。精确像素上限、压缩参数为配置，不支持的输入返回 422，不能静默丢照片后保存空衣物。此限制属于待评审技术容量，不宣称已测得设备兼容性。

上传顺序为：

1. 短事务登记幂等上传 reservation 与 `staging` 元数据，冻结 owner/purpose/hash，提交；pending 的重复请求返回待重试，不新建第二文件。
2. 事务外验证内容及写入私有文件，采用临时文件 + 原子重命名（对象存储则在 put 成功后继续）。上传体/流有总量限制，不能先完整读无界内容。
3. 短事务标记 `ready` 并完成幂等操作，才返回成功。文件写成功而数据库未提交时不回假成功；恢复核对 reservation 与内容 hash，可验证存在则完成，否则明确失败、允许重试相同内容。
4. 保存衣物/头像事务锁定 media，校验同账号、正确用途与 ready，绑定引用；更换/移除仅解除当前对象引用，不立即删仍被引用的媒体。

读取走 `GET /api/v1/media/{id}/content`，经当前用户授权后返回二进制及正确 MIME、`Cache-Control: private, no-store`，这是业务 JSON 信封的二进制例外。小程序以带 Bearer 的 `downloadFile` 获取临时路径再传给 Image，不能把 Token 放 query 或假设 Image 自动带鉴权头。下载回调比对会话，退出/切账号删除已登记临时文件和引用；不写公开相册、不使用跨会话持久图片缓存。生产对象存储同样由后端鉴权读取，不让客户端获得永久可分享的私有照片 URL。

### 失败、清理与备份

- 上传失败保留其他表单值和本地候选；更换图片先取得新 ready ID 后再替换，不因选图取消丢原图。旧上传的迟到结果以选择 generation 丢弃，不能覆盖新选择。
- `staging` 无文件、已写文件未 ready、ready 未绑定都可由显式维护任务核对。清理只处理超过 24 小时且没有衣物/资料引用的对象，先锁媒体并改 `deleting`，使新绑定失败，再在事务外删文件，最后删元数据。删除失败重试相同 storage_key；崩溃后继续 deleting，不回到 ready。
- 清理与绑定竞争由媒体行锁串行裁定。清理已先获胜时保存返回明确“图片已失效，请重新上传”，保留其他输入，不创建空衣物。已归档衣物的图片仍有引用，不清理。
- 业务历史只承诺名称/类别快照，不复制每次图片版本；历史缩略图取当前仍可授权的媒体，缺图用占位，不影响历史文本与统计。
- 私有目录须为持久卷，并与数据库协同备份/恢复；数据库恢复不能证明文件存在。迁移到对象存储保留 media ID，以逐对象复制/校验后切 storage_key 的方式迁移，不改业务引用。

## 4. 穿着记录与历史快照

`POST /api/v1/wear-records` 输入 `wear_date`、表单展示的 `expected_timezone`、非空 `garment_ids`、可空 `source_recommendation_id`，使用 Idempotency-Key。推荐来源仅作追踪，服务端不把“来源存在”当成用户实际穿过；记录只由这个明确保存操作产生。推荐自动完成、替换或换一套均不触发记录写入。

服务端锁当前账号 revision 与所选衣物，验证全部属于本人后去重，每件只写一个 item。手动补录允许选择本人已归档或暂不可穿衣物，因为补录描述过去事实；这不使它们恢复可穿或参与推荐。多选列表支持查看这些状态并标明状态，默认不隐藏原记录中已选归档项。确认推荐进入记录表单后也以用户最终选择为准。

服务端按**当前已保存时区**计算 today，拒绝 wear_date > today，不接受客户端自报 today。若 expected_timezone 与当前设置不同，响应 409 `timezone_changed`，返回有效时区供刷新说明与日期重新确认，不能静默换日；更新记录同样携带该字段。记录保存 `wear_date` 与 `timezone_at_save`；后续更改个人时区不重排历史，今天/近 30 日边界按新设置重新计算，查询同时返回有效时区与日期范围。设计 `RYACG` 中上海时间属于默认示例，运行时必须动态显示。

创建时名称与类别从锁定衣物复制；图片衣物的 name_snapshot 可以为 null，保留未知及 UI 占位语义。类别快照包含稳定类别 ID 与当时标签，不只存一个会随目录变化的 FK。

修改使用 `PATCH /wear-records/{id}`、If-Match 和 Idempotency-Key，在一个事务中更新日期及 item 集合：已有 garment ID 保留原快照；新加入衣物生成当前快照；移除项删除。不会因修正日期而把所有旧快照刷新成现名。日期被修改时使用此次有效时区重新验证并更新 timezone_at_save，仅改衣物集合时保留原日期归属说明。

删除使用 `DELETE /wear-records/{id}`、If-Match 和 Idempotency-Key，事务中删 record/item 并标记操作墓碑。相同删除重试成功，其他账号一律 404；迟到旧更新因目标已删而失败，不能复活。记录创建的相同键在删除后返回已删除结果，客户端不因此重建。

`GET /wear-records` 支持日期范围和 page/page_size，按 wear_date DESC、created_at DESC、id DESC；`GET /wear-records/{id}` 返回 item 快照及当前可查看状态。默认历史近 30 日，同时可查询更早范围；同日多条保持独立，不按日期或衣物组作唯一约束。

## 5. 统计读取与一致性

`GET /api/v1/statistics?from_date=&to_date=`，默认结束为用户时区 today，起始为 today - 29 天，含首尾。响应明确范围、时区、generated_at，分别返回当前库存、累计穿搭次数、期间穿搭次数、期间每日趋势、按衣物的累计记录次数。UI 中“近30天穿搭”读取期间值，不能把它当累计次数。

- 库存：可穿 + 暂不可穿总数，归档单列；类别按当前非归档衣物属性汇总，null 归未分类。
- 穿搭次数：record 行数；单件次数：对应 item 行数，唯一约束保证同一条不重复。归档衣物仍保留历史穿着计数。
- 趋势：按 wear_date 计数并补齐范围内零日，不把零日解读为未穿。API 返回每日事实；图表如按周展示，需按响应自然日切段，最后不足一周也保留并显示真实范围。
- 一次统计请求的多条 SELECT 使用只读 REPEATABLE READ 快照，使总数、类别与趋势对应同一提交视图；不从不同 TTL 缓存拼出不一致统计。V1 不建立持久计数器或统计缓存。

索引首先覆盖 `garments(user_id,status,created_at,id)`、`wear_records(user_id,wear_date,id)`、`wear_record_items(user_id,garment_id)` 以及外键/唯一约束。标签等筛选待真实查询计划证明后再加索引，不给每个属性机械建索引。聚合规模和耗时尚未测量。

## 6. 最小验证与失败处理

| 不变量 | 后续最小检查 | 失败证据与处理 |
|---|---|---|
| 归属不越权 | A/B 两账号对衣物、媒体内容、记录增改删和 ID 集合操作 | 任一 B 字段/图片泄露或写入即阻断交付，回授权 service/复合外键 |
| 一次保存只产一条 | PostgreSQL 并发同键创建；同键异内容；提交后断响应再试；删后再试原创建键 | 行数/幂等资源 ID 不符，修唯一约束、事务及墓碑 |
| 历史不随衣物变化 | 记录→改名/改类/归档→仅改日期→增删单品 | 原保留项快照变化即失败，修 item 差分写入 |
| 修正删除无残留计数 | 同日多套、集合去重、删记录后同快照统计、归档计数 | 聚合与 record/item SQL 事实不一致，修查询及缓存失效 |
| 日期正确 | 不同时区午夜、DST、未来日期、表单打开后改时区、30 日首尾 | 日期错误或静默归日，修服务端校验与动态提示 |
| 文件和元数据可恢复 | 写文件后中断、ready 前中断、绑定/清理竞争、缺文件恢复、私有下载换会话 | ready 指向不存在文件、删已绑定图或旧图片进入新会话即失败 |

本阶段未运行上述检查。迁移验证还需覆盖已有 users 的密码登录、微信新用户并发创建和数据回滚，不清空现有开发数据。真机选图、键盘、资料填写及图片展示的验证不能由这些数据测试替代。
