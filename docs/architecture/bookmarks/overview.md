# 个人资源收藏夹技术方案

## 范围与来源

本方案说明 REQ-BOOKMARKS-001 的收藏领域代码边界、数据流与行为契约。产品范围与确认来源见 [PRD](../../product/bookmarks-prd.md)，代码检查与人工验收状态见 [当前进度](../../../manager/progress.md)；不增加 AI、分享或网页抓取能力。

UI 使用 [收藏夹设计交付](../../design/bookmarks-design.md) 的同一来源及场景映射。2026-10-13 已通过 Pencil MCP 实际读取九个根 Frame 和其中的表单、操作、反馈及手机结构；保存版 SHA-256 为 `234a29969acacf918dd86d0e80bc5d30865c4077d5becd3d139e28dc6f1feb66`。PRD 本次来源 SHA-256 为 `25f9a29b72e6c693948b808e410690ac2a1ff1d01d64d2a8d2326ade1b08fe40`。哈希用于下游识别变更，不是供应商修订或产品验收。

| 消费区域 | 设计依据 | 技术对应 |
|---|---|---|
| 浏览、筛选、分页 | `frGCk`、`U596kS` | 同一查询状态与 DTO，桌面列表、手机卡片 |
| 当前页选择和移动 | `EapSM/fISvK`、`mJdGV` | 页内 ID 集合、原子移动、完成后重新查询 |
| 收藏新增与编辑 | `F8Q3b/XMjMl`、`wPuex` | 一个四字段表单，create/edit 模式与独立草稿 |
| 分组维护与删除 | `ALjzf/HDGhN`、`ALjzf/WODao` | 一个名称表单、一个按对象类型组合的确认窗口 |
| 空态、菜单、备注 | `XGUVa` | 场景参数与目标对象；不按文案复制组件 |
| 失败和结果未知 | `I5Qsg/LDOKZ` | 业务错误与操作回执恢复；两者不能混淆 |

实现沿用 [系统边界](../README.md)、[API 规则](../../engineering/backend/standards/api-and-error-contract.md) 和 [跨端契约](../../contracts/README.md)。接口 schema 由提供方 Pydantic/路由生成 OpenAPI，同步契约导航与消费者，不手改 generated 快照。

## 实现边界与现有落点

- 后端沿用同步 FastAPI → service → repository → SQLAlchemy；请求复用 `get_current_user`、请求 Session 和 `transaction`。认证返回的 User 可能来自缓存，不能将该对象当作已锁定数据库行。
- 新增收藏领域的 router、schema、service、repository 和 model，分别放在现有 `backend/app/` 对应目录；由 `backend/main.py` 注册。不建立通用 CRUD 引擎，也不导入 AI 服务。
- 前端新增 `pages/bookmarks/BookmarksPage.tsx`，在 `app/router/routes.tsx` 登记 `/bookmarks`；业务 API、query/mutation、草稿和操作状态归 `features/bookmarks/`，通过其 `index.ts` 公开。页面负责组合，不另建全局收藏 store 或预建 entities 空壳。
- 沿用 `shared/api/requestClient.ts` 的 Bearer 注入及错误归一化、`AppProviders` 已有 QueryClient。后端真实模式是交付验证目标；认证 mock 不能作为收藏 API 联通证据，也不自动提供假收藏数据。
- 页面复用 `AppShell hideFooter`。`/` 重定向到 `/bookmarks`，`AppHeader` 通过应用标题返回收藏夹，只保留设置和账户入口，手机布局不再包含模板展示导航；真实布局与交互仍按最终验收位置核对。
- 主题/i18n 沿用现有 Provider 与 `global.css`。Input、Select、Textarea、Button、Dialog、DropdownMenu、Tooltip、Skeleton 复用真实 shared UI；业务表单、空态与反馈留在收藏模块，不因共用文案结构提升到公共层。
- shared UI 没有独立 Checkbox；当前页选择使用收藏业务内的原生 checkbox 组合，维护 DOM indeterminate、键盘语义与正式触控/颜色/焦点 Token，不新增公共组件或依赖。

## 数据模型与一致性

所有业务表由 Alembic 显式迁移；不在服务启动或请求中建表。主键使用 UUID，用户外键沿用 `users.id` INTEGER。时间为 UTC timestamptz，API 输出带时区 ISO 8601；客户端按现有语言/时间设置显示。

| 表 | 核心字段与约束 |
|---|---|
| `bookmark_groups` | `id, user_id, name, name_key, created_at`；唯一 `(user_id,name_key)`；唯一 `(user_id,id)` 供复合外键引用 |
| `bookmarks` | `id, user_id, group_id NULL, title, url, note, created_at, updated_at`；`user_id` 外键；`(user_id,group_id)` 复合外键指向本用户分组，禁止跨账号归组 |
| `bookmark_operations` | `(user_id,operation_id)` 主键、`request_hash`（取消占位允许为空）、`kind`、终态、`resource_id`、`changed_count`、`error_code`、`completed_at`；不保存标题/URL/备注/令牌或完整请求 |

“全部”仅为查询入口；“未分组”用 `group_id=NULL`，均不建伪分组行。分组删除使用 RESTRICT 约束：service 同事务先移动收藏、再删分组，不能通过 FK 自动置空绕过更新时间逻辑。账号外键可级联删除其业务行，但本期不新增账号删除 API。

查询索引为 `(user_id,updated_at DESC,id DESC)` 与 `(user_id,group_id,updated_at DESC,id DESC)`；分组按 `created_at ASC,id ASC` 稳定排列。收藏严格按 `updated_at DESC,id DESC` 排序，同次批量变更使用同一个数据库时间值。重命名分组不写收藏；批量移动只写归属实际变化的行；编辑成功更新时间，即使字段值相同也视为一次编辑。

本期使用数据库用户行作为每账号一致性锁：收藏领域写用例先由 repository 查询 `users.id` 并 `FOR UPDATE`，所有入口保持相同锁顺序；读取列表、计数与分组快照时持有该行 `FOR SHARE` 至读事务结束。这样无需引入计数缓存或全局锁，能在默认隔离级别下防止同用户写入穿插多个读取语句。不同账号不互相阻塞。锁只跨本地数据库操作，事务内不请求 Redis、网络或执行 UI 等待；认证依赖在进入领域事务前完成。真实 PostgreSQL 锁行为必须集成验证，SQLite 测试不能替代。

## 输入、权限与查询契约

标题及分组名先去首尾空白，再按 PRD 长度校验；长度按 Unicode code point 统一计数，前端不能仅依赖 UTF-16 `string.length`/原生 maxlength。`name_key` 对修剪后的名称只将 ASCII A–Z 转小写，唯一约束兜底并发重名；拒绝“全部”和“未分组”。不擅自对其他字符做兼容归一化。备注不自动裁剪，空备注统一为空字符串。标题、备注和分组名称在字段边界拒绝 PostgreSQL 无法存储的 U+0000，返回对应字段 422，不截断或替换用户内容。数字主机按浏览器 IPv4 解析范围校验，允许有效缩写/进制表达并保留原 URL。

URL 去首尾空白后须为具有有效主机的绝对 HTTP/HTTPS 地址，长度不超过 2048，拒绝控制字符和其他 scheme；校验后保留地址字符串，不擅自删除 query/hash、合并重复 URL 或访问目标站点。前端以安全外链 `target="_blank" rel="noopener noreferrer"` 打开。标题/备注作为文本渲染，禁止 HTML 注入。

每条查询和写入以认证 `user_id` 为边界；客户端不能提交 owner。单资源不存在与不属于当前用户统一 404。移动校验所有去重后的 IDs 与目标分组，任何一项不属于当前用户或不存在则全部失败，错误不披露他人数据。框架 422、认证 401、认证依赖 503 沿用现有信封及语义。

所有路径前缀为 `/api/v1`，成功外层使用 `ApiResponse[T]`。

| 方法与路径 | 输入 | data 与语义 |
|---|---|---|
| `GET /bookmarks` | `group=all/ungrouped/<uuid>` 默认 all；`q` 默认空；`page>=1` 默认 1；page_size 固定 10 | `list,total,page,page_size` 加 `groups,all_count,ungrouped_count`；列表 DTO 含 `id,title,url,note,group_id,updated_at`，groups 含 `id,name,count` |
| `GET /bookmarks/{id}` | 目标 ID | 当前收藏 DTO，供编辑回填与失效对象检查 |
| `POST /bookmarks` | `title,url,group_id=null,note=""` | MutationResult |
| `PUT /bookmarks/{id}` | 完整四字段 | MutationResult；不接受 owner/updated_at |
| `DELETE /bookmarks/{id}` | 无业务 body | MutationResult；保留所属分组 |
| `POST /bookmark-groups` | `name` | MutationResult |
| `PATCH /bookmark-groups/{id}` | `name` | MutationResult；不触碰收藏排序 |
| `DELETE /bookmark-groups/{id}` | query `expected_count>=0` | MutationResult；确认数量变化则 409，请用户检查最新影响后再确认 |
| `POST /bookmarks/batch-move` | `bookmark_ids`（1–10 个互异 ID）、`target_group_id` 可为 null | MutationResult；同组行不计入 changed_count |
| `POST /bookmark-operations/{operation_id}/resolve` | 无业务 body | OperationResult；确认旧操作终态，或阻止尚未开始的旧操作，详见恢复规则 |

分页基础 `Paginated[T]` 按现有 API 规则放 `schemas/response.py`；收藏列表响应在领域 schema 组合扩展分组快照，不将业务计数加入公共分页基类。动态 `/bookmarks/{id}` 路由在固定动作路由之后注册，避免 batch-move 被当作 ID。

查询将 `q` 去首尾空白，标题或 URL 包含匹配，ASCII 英文不分大小写。SQL 使用绑定参数并转义 `%`、`_`、转义符，使用户输入按字面子串匹配；不让通配符改变含义。数据与关键词的 ASCII 转小写规则一致。搜索不包含备注。

一次列表响应在上述共享锁保护下计算全部数量、各分组数量、筛选 total 及当前页数据。服务端将越界 page 限制到 `max(1,ceil(total/10))` 并返回实际 page；total 为 0 时 page=1。无效/已删自定义分组返回 404，由前端清除失效筛选并转入未分组，保留关键词。列表分页不单独依赖客户端减一推算。所有自定义分组及其数量同次返回；大分组集合的查询耗时是待验证项，不用静默截断使移动目标缺失。

## 写入、原子性与结果未知

收藏及分组的每个写请求必须带 UUID `Idempotency-Key`，对应当前用户的 operation_id。请求 hash 覆盖规范化后的方法、路径及业务参数；移动 IDs 排序后哈希。一个提交意图生成一个 key，网络重发保持 key；用户在明确终态后修改输入或主动再次执行才生成新 key。禁止按 URL 去重，因为产品允许重复收藏。

`MutationResult` 为 `operation_id,kind,resource_id|null,changed_count`，只在成功时返回；不把陈旧资源副本作为重放响应。资源变更和 succeeded 操作记录在同一数据库事务提交，重放同 key/同 hash 返回原回执且不重复变更，再由客户端读取最新快照。同 key/不同 hash 返回 409。操作记录不因资源后续删除而消失。

写入持有用户排他锁后先查操作记录，再验证资源和业务条件，最后执行变更并写回执。明确业务失败可用 savepoint 回滚业务子事务，外层保存 failed 回执后提交，再在事务外抛对应 BusinessException；不能抛异常导致失败回执也被外层回滚。未捕获数据库异常整体回滚，不伪造 failed 终态。数据库唯一约束异常仅识别具体名称唯一冲突，不把其他 IntegrityError 都归为重名。

批量移动和删除分组分别使用一次领域事务。移动先验证所有目标与所有源，再更新；目标不存在、任何收藏不可用或发生写入错误都不能部分成功。删除分组在锁内核对 expected_count，再统一更新组内收藏时间与归属并删除分组；数量变更则返回明确冲突，刷新确认内容。成功删除当前分组后前端转入未分组；后台删除非当前分组保持当前筛选。

| 客户端观察 | 处理方式 |
|---|---|
| 收到成功回执 | 关闭对应表单/确认，清空成功移动的选择，刷新同账号列表与分组快照；刷新失败提示“操作已完成，列表未更新”，不能改称写入失败 |
| 可信字段/业务错误 | 保留草稿；批量只保留刷新后当前页仍可操作的 IDs；修正或重试创建新意图/key |
| 超时、断网、无可信业务结果的 5xx | 进入 unknown，保留草稿及 operation_id，禁用该意图再次提交；显示“查看最新结果” |
| 查看最新结果 | 调用 resolve；终态成功刷新视图，failed/not_executed 保留草稿并允许新的明确提交；resolve 本身失败继续 unknown |

resolve 是有副作用的 POST，不能用普通 GET 伪装：它获取与写请求相同的用户排他锁。若原事务已运行，等待其结束再读回执；若没有操作记录，在锁内写入 `not_executed` 占位后提交。所有随后到达的原 key 请求必须检查此占位并拒绝执行（409），从而消除“查不到结果，但旧请求稍后才提交”的窗口。重复 resolve 返回同一终态。OperationResult 为 `operation_id,status(succeeded/failed/not_executed),kind|null,resource_id|null,changed_count,error_code|null`，不得返回他人记录。未取得锁或提交确认时不报告 not_executed。

操作表与取消占位本期不自动过期，防止旧请求在清理后再次执行；只保存最小元数据。后续容量治理若要过期，必须同时定义旧 key 拒绝策略。前端 sessionStorage 仅按 userId 保存未确认 operation_id/动作类型，不存请求内容或令牌；刷新后可继续“查看最新结果”，字段草稿仍是当前页面内存状态。登出/换账号清除内存业务数据和对应缓存，恢复记录仅在同用户重新登录后可读取。存储不可用时仅当前页面保留恢复能力，不将持久存储写失败误判为业务失败。

## 前端状态与组件实现

- 路由 query 保存已提交的 `group,q,page`；搜索输入为独立草稿，按搜索按钮或 Enter 提交，清空按钮立即清 q。提交的新筛选或翻页同步清空选择并重置所需页码；前进/后退遵守同样规则。
- Query key 包含当前 `userId`、认证会话代次以及 group/q/page；认证变化取消在途请求、移除旧用户缓存并关闭其表单，响应回调核对会话代次，防止迟到请求污染新会话。未认证不请求或展示收藏，复用认证宿主提示登录；UI 守卫不能替代后端鉴权。
- 当前页 `Set<id>` 是唯一选择来源，全选只操作已加载页；pending 或 unknown 的旧操作独立持有提交时 IDs，不能读取后来改变的选择。查询返回时与当前页有效 IDs 求交。切换条件后旧列表不能继续接受选择。
- 成功后 invalidation 覆盖该用户收藏查询（内含所有分组计数）；不在客户端手动乐观增减计数或移走条目。失败保留旧数据并说明 stale；首次 loading 与 total=0 分开。
- 一个 BookmarkForm 承载新增/编辑，一个 GroupForm 承载创建/改名，一个 DeleteConfirmation 按资源类型填入后果与动作；删除收藏必须显示标题与 URL，删除分组必须显示影响数量。共享结构不能混淆目标 ID 或遗漏业务信息。
- Button loading 之外，form onSubmit 同步锁定当前意图并设置 mutation retry=false。对话框关闭不会取消已发出的服务端操作；在途状态交给页面操作状态持有，关闭后仍展示进度/unknown 恢复入口。确认提交前的取消不请求 API。
- 初始/编辑回填失败不显示伪空值可提交表单；回填后草稿不被后台刷新覆盖。现阶段编辑使用最后成功提交覆盖，服务端仍重新校验对象与归组；不新增协同编辑或冲突合并产品。
- 公共 Dialog/Footer 已支持组合及窄屏反向排列，调用方以取消、保存的 DOM 顺序承载手机“保存在上”。浮层限高和内部滚动在业务组合上补足；焦点入口、错误聚焦、关闭恢复、44px 触控范围与键盘行为按 [UI 状态规则](../../engineering/frontend/standards/accessibility-and-ui-states.md) 实现。
- 中文/英文资源沿现有 i18n 落点新增；业务 code 映射到本地化文案，不直接展示传输层英文错误。422 的 loc/type/msg 映射到字段，名称冲突归名称字段，失效资源使用整体反馈。

建议错误分配：40410 资源不可用，40910 名称冲突，40911 key 内容冲突，40912 删除影响数量已变化，40913 操作已被 resolve 阻止，40914 移动对象或目标不可用。字段格式沿 42200；新增业务码实现时集中定义并同步契约。未验证状态不得借 500/503 直接推断“绝对没有写入”。

## 可行性、依赖与检查

收藏领域沿现有 UI 和认证基础承接已确认设计，包含业务持久化、分页 DTO、操作回执/恢复、账号缓存隔离和手机顶栏适配。代码检查、实际运行与产品验收分开记录，静态阅读不能证明真实运行。

行为依据为已确认 PRD 与固定设计来源；迁移和提供方契约供实际消费者使用，设计示例不能代替真实数据或验证。实现与验收职责见 [交付流程](../../engineering/workflow/delivery.md)。

| 验证范围 | 必须覆盖的证据 |
|---|---|
| 数据与 API | 双账号 CRUD/非法归组、字段边界与中文/emoji、重复 URL 可保存、保留字符搜索、10 条分页及越界回退、全局计数不随搜索变化 |
| PostgreSQL 集成 | Alembic 升级、FK/唯一约束；并发重名；删除分组与移动竞争；写入中途异常全部回滚；重复 key 并发仅一次变更；resolve 与迟到请求两种锁顺序；提交后响应丢失仍可恢复 |
| 排序 | 同时刻按 id 稳定；编辑与实际移动更新时间；同目标批量无变化；分组改名顺序不变；删除分组的迁入时间与总数正确 |
| 前端逻辑 | 筛选/翻页清选择、迟到响应和账号切换隔离、字段保留、重复点击、unknown 不重发、resolve 成功/失败/未执行、成功后刷新失败、有效选择交集 |
| 契约与工程 | 实现后按两端 README 检查、make architecture、生成/校验 contracts；现有 backend SQLite/fake Redis 夹具不证明真实锁与数据库原子性 |
| 产品与设计验收 | 经授权运行后核对 1440 桌面和 390 手机、长文本/小视口、两主题、手机两行顶栏、键盘焦点、200% 文字、浮层滚动和完整个人任务路径 |

迁移只在确认的本地隔离环境或授权环境执行；生产回滚不能直接 drop 已有收藏。上线失败优先回滚应用并保留新表数据，迁移降级删除数据须单独授权。数据库逻辑验证使用 [后端 README](../../../backend/README.md) 的独立 PostgreSQL schema 夹具，覆盖真实迁移、锁、约束及原子操作；SQLite/fake Redis 不替代这些证据。大集合成本测试完整返回分组，不因测试或性能假设静默截断。浏览器与产品/视觉验收单独安排。

本方案作为后续 Change 的行为依据；代码验证不代替最终产品 human_acceptance。
