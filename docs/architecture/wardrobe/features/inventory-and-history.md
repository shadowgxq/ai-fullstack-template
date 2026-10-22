# 衣物、媒体与穿着事实

状态：R2，V1 采用 Backend 本地文件存储，目标设计。共享身份、错误及客户端边界见 [总览](../overview.md)。产品依据为 FR-001～FR-005；不新增永久删除衣物、共享衣柜或图片识别。

## 数据归属与不变量

Backend 业务库持有以下拟议表。所有 repository 按 `owner_id` 查询，写入前也按同一账号校验关联资源；对象 ID 不能代替授权。

| 数据 | 关键字段与约束 |
|---|---|
| `garments` | id、owner_id、name 可空、photo_media_id 可空、category/color 可空、season/occasion/tag 数组、note 可空、status、version、created_at/updated_at；status 为 wearable/unavailable/archived |
| `media_assets` | id、owner_id、storage_key、用途 garment/avatar、内容类型/字节数、state、created_at；storage_key 不对外暴露 |
| `wardrobe_preferences` | owner_id 唯一、喜欢/避免的风格颜色场合、comfort、version；未填保持空，不推断偏好 |
| `wear_records` | id、owner_id、wear_date、timezone_at_save、version、created_at/updated_at |
| `wear_record_items` | record_id、garment_id、name_snapshot、category_snapshot；唯一 `(record_id,garment_id)`，外键保留衣物关联 |
| `idempotency_receipts` | owner_id、operation、request_key、规范化 payload hash、resource_id、响应摘要；唯一前三者，和对应写入同事务 |
| `wardrobe_revisions` | owner_id 唯一、inventory_revision/preferences_revision/history_revision；对应写入同事务递增，供推荐失效判定 |

数组去重、去除空白值，未知单值存 NULL，不用“其他”“四季”“不限场合”填补事实。展示未知名称时使用“未命名衣物”，快照仍保存 NULL 而非把展示占位当用户名称。类别统计的“未分类”是 NULL 分组。主色为单选，季节/场合/标签为多选；选项目录有稳定 ID/标签及版本，可允许未知，衣物颜色不是任意 HEX。

初始目录来自 PRD 语义和设计中的有效选项，完整选项集合在实现时形成版本化数据与消费测试；不把示例数量设为产品上限。目录还应提供风格等用于偏好与推荐的明确词表、分类到风格/场合的可证明映射；不存在映射的属性不得被模型认定为事实。自定义标签是用户文本，不执行其内容。名称/备注等容量限制由 DTO 明确，错误保留输入，不能静默截断。

## 图片上传与访问

V1 以单张主图实现可选照片，接口使用 `photo_media_id`；不引入相册管理或“最多五张”限制。若需要多图行为，应先回 PRD 明确。

1. 小程序用户主动选择 camera 或 album，取消保持原图；临时路径只作本地预览，不算已上传。
2. `POST /api/v1/media` 使用认证 multipart 上传及 `Idempotency-Key`，用途指定 garment/avatar。Backend 以流式限制读取，核验解码格式、真实内容、尺寸与容量；建议初始仅 JPEG/PNG/WebP、最大 10 MiB，属于接口技术限制，返回明确 413/422。去除 EXIF 定位信息并重编码，不把可执行/SVG 内容作为照片。
3. 先建立 pending 媒体行，再在事务外写 Backend 本地私有目录，确认写入成功后短事务转 ready，响应媒体 ID。文件访问使用 `put/read/delete` 内部接口，操作服务端生成 key，不接收外部 URL 下载。
4. 上传幂等键绑定原文件摘要和用途；同键同内容复用 ready 媒体，pending 返回可查询状态，不再创建对象；pending 对账确认不存在目标文件后才重试。不同内容同键 409。响应丢失可用同键重试或查询媒体操作状态，不能仅凭本地路径判断成功。
5. 保存衣物/头像时锁媒体行，验证同 owner、用途匹配且 ready，并在资源事务中建立引用。名称空白且无成功媒体时拒绝创建，返回 PRD 指定提示。

本地存储目录由服务端 `MEDIA_STORAGE_ROOT` 配置，位于公开静态目录之外；DB 只保存相对 storage_key，不保存主机绝对路径。路径必须解析并限定在该目录内，禁止路径穿越与符号链接逃逸。使用同目录临时文件写入、落盘并原子 rename 到目标位置，重试前按摘要核验已存在文件。容器部署绑定持久卷，备份同时覆盖数据库与媒体目录；不把临时目录或容器可写层当作持久存储。V1 不接入第三方 OSS。

客户端 `GET /api/v1/media/{id}/content` 经 owner 校验后由 Backend 流式返回，图片请求必须携带 Bearer；不能使用公开永久 URL。若 Taro Image 无法直接携带认证头，功能层先用认证 downloadFile 取得临时本地路径再显示；切号删除本地图片缓存，不能把 token 拼 URL。媒体列表/授权失败按不存在处理。

未被资源引用的 ready 文件超过 24h、pending 长期未完成可由显式清理任务处理；清理与资源绑定锁同一媒体行，确认无引用后置 deleting，阻止新引用，再删除目标文件和最终状态。本地文件删除失败保留 deleting 供重试。已引用、穿着展示仍依赖的媒体不可作为孤儿清理；本方案历史仅冻结名称类别，历史图若展示来自当前衣物，不声称保存了旧照片。

选择新照片上传失败时保留本地预览和其他输入；不自动沿用旧媒体冒充新照片保存成功。移除/替换只更新资源引用，旧图片走无引用清理。两端失败不得使用户得到虚假成功。

## 衣物与偏好 API

拟议资源前缀 `/api/v1`：

| API | 契约差异 |
|---|---|
| `GET /wardrobe/options` | 版本化目录，返回稳定值，不根据用户空值自动填充 |
| `GET /garments` | status/category/color/season/occasion/tag 筛选；wear selector 可选全部状态，recommend selector 仅可穿并通过硬约束；游标语义见总览 |
| `POST /garments` | name/photo_media_id 至少一项，新衣物固定 wearable；Idempotency-Key 必填 |
| `GET /garments/{id}` | 当前属性及按事实聚合的 wear_count；不返回其他用户字段 |
| `PATCH /garments/{id}` | `expected_version` 防止并发覆盖；可更改状态及可选属性，NULL/空数组明确清空，缺字段表示不修改 |
| `GET/PUT /preferences` | 当前已保存偏好；PUT 为完整编辑表单，携带 expected_version，成功才更新有效偏好 |

同字段明确喜欢和避免互相冲突时返回字段错误，请用户修正，不能静默删掉任一选择。偏好中的“避免”是硬条件，推荐专项给出可判定与未知的处置。

写 service 事务内锁账号 revision 行，再按稳定 ID 顺序锁所需资源；校验版本、关联媒体、内容后写入并递增相应 revision。归档只改状态，恢复显式选择 wearable 或 unavailable，不增加永久删除接口。客户端 pending 防连点只是体验措施；POST 的数据库幂等唯一约束才是重复提交保障。

## 穿着记录与快照

`GET/POST /wear-records`、`GET/PATCH/DELETE /wear-records/{id}`。创建输入为 `wear_date`、去重后的非空 `garment_ids`，可附推荐来源 ID 作审计；绝不以来源替代所选衣物或代表自动确认。Backend 从 profile 读取当前时区，计算当前自然日，未来日期拒绝。每条记录允许同日多套，数据库不建 `(owner,date)` 唯一约束。

创建在同一事务内校验幂等收据、锁 revision、校验本人衣物、写 record 和 items 快照、递增 history_revision、写收据；任一失败全部回滚。快照从本次保存时有效衣物取得，不能信任客户端名称类别。同条重复 ID 只保留一次。客户端发起一次保存生成一个稳定 UUID key；网络不明时保留该 key，主动重试仍使用它。确认收到成功后新建另一次表单才换 key；不同内容重用旧 key 返回 409，不自动另建记录。收据不按短 TTL 删除，至少覆盖该账号记录生命周期；记录后来删除仍保留 tombstone 收据，旧请求不能复活记录。

历史可以记录本人所有状态衣物：归档或暂不可穿不影响用户确认过去穿着，只影响推荐。这是补录历史所需技术语义；选择器不硬套推荐的 wearable 过滤。跨账号/不存在衣物统一拒绝，不部分保存。

修改携带 expected_version；日期按当前 profile 时区校验，保存新的 timezone_at_save，不将已有 date 转成另一日期。保留的 item 沿用原快照，移除项删除，新加入项从当前衣物取快照，避免只改日期就改写历史名称。并发衣物编辑与记录保存使用相同 revision 锁序确定快照先后；历史是该次保存可观察的值。

删除只删除该记录和 items，递增 history_revision；幂等 DELETE 重试返回成功，不删衣物，跨账号对象仍不泄露。版本冲突返回 409，保留草稿并提示刷新核对；不以最后写入覆盖用户刚修改的事实。PATCH 的重复同次成功请求可依收据返回原结果，避免响应丢失被误报成版本冲突；收据 operation 包含对象 ID 和方法。

## 统计消费与一致性

统计不采用累计计数字段或异步刷新物化结果。`GET /statistics` 在一个一致读快照内查询库存、历史和趋势；写入提交后下次读取立即反映修正，避免各指标分开查询跨越一次修改。

- total = wearable + unavailable；archived 独立计数。类别分布只查 total 范围，NULL 单列未分类。
- outfit_count = 本人 wear_records 数量；garment wear_count = 该 garment 关联 items 数量，归档不排除。
- trend 默认按用户当前时区的今天及之前 29 天，按记录存储的 wear_date 分组并补零，响应带 start_date/end_date/timezone。时区修改影响今天和未来日期校验，不搬移既有 date；旧记录保留保存时区供追溯。
- 无记录返回零与空事实说明，客户端显示“暂无已记录穿着”，不解释成从未穿过。类别历史快照用于历史展示，不拿它替代当前库存类别分布。

owner/status/category、记录 owner/date/id、items garment_id 与各幂等键建相应索引。初期没有可证实负载数据；若隔离数据测量显示聚合超出目标，再考虑读模型，并保留事实为唯一权威，不能提前建立计数双写路径。

## 关键验证

后续用隔离 PostgreSQL 验证：同 key 并发 POST 仅一条；同 key 异 payload 冲突；保存提交后丢响应重试不增行；删后旧 key 不复活；PATCH 保留原快照、新增项取当前值；归档计数仍在；跨时区午夜与未来日期拒绝；统计修改删除后无残留。媒体用存储 fixture 注入 put 成功/DB 失败、pending 重试和清理/绑定竞态，证明不会丢已引用图片。后续使用隔离临时目录验证本地写入失败、原子发布、路径逃逸拒绝及文件/DB 状态对账；持久卷重建后文件保留和 Taro 认证下载显示仍需实际验证。当前仓库尚无业务媒体后端，本方案描述拟新增的本地存储，不表示模板已支持上传。
