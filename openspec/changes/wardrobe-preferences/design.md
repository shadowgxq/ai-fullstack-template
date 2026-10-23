# 长期偏好实现

## Context

范围见 [proposal](proposal.md)，消费[推荐方案 §2](../../../docs/architecture/wardrobe/features/outfit-recommendation.md#2-偏好候选与模型输入)（2026-10-22工作树SHA256 `66462d5cc591ebb84f5d4932d1a50bd9a581fd255d0153283c801f9d57621803`）及[共享契约](../../../docs/architecture/wardrobe/overview.md#4-共享数据与接口约定)。`personal-profile` 已 code-verified，真实设置、会话查询、固定版本编辑和未知结果恢复可复用。前置 `wardrobe_catalog` 已有 styles/colors/occasions；本项扩展长期偏好模型/API及独立preferences_revision。

## Goals / Non-Goals

**Goals:** 以单一本人偏好事实和原子修订提供可独立验证的保存/读取；UI与衣物同目录，失败不丢草稿。

**Non-Goals:** 不新增推荐、语义解析或衣物属性，不改变单次scene、库存/历史/资料版本；舒适度原文作为可选文本保存，仅作后续AI补充参考，不进入硬排除，不宣称已验证文本要求或保证舒适效果。结构化风格/颜色/场合避免项仍为硬约束。

## Decisions

### 数据和默认值

- 新建 `wardrobe_preferences`，owner_id为User整数主键/外键，六个JSON字符串数组 `liked_styles/avoided_styles/liked_colors/avoided_colors/liked_occasions/avoided_occasions`、可空 `comfort_notes`（trim空白为null、最长500字符）、正整数version。集合规范去重排序，选项严格来自现有目录；不从名称、类别或照片推断风格。
- 未保存时GET返回版本0、六空数组、comfort_notes null；读取不隐式写库。首次PUT expected_version=0在账户锁内创建version1，其后按正版本更新。已保存的空偏好仍有正版本，避免把“尚未保存”与“清空后保存”混为一谈。相比GET时创建默认行，此选择不扩大登录/迁移写入和读取副作用。
- AccountRevision 增加 `preferences_revision NOT NULL DEFAULT0 CHECK>=0`；仅偏好PUT递增，已有inventory/history保留。PreferencesView带当前 `catalog_version`，与既有WardrobeOptions使用同一常量，供推荐冻结来源；不建Redis偏好缓存或第二份User资料。

### API与事务

- `GET/PUT /api/v1/preferences` 返回本人 `PreferencesView`；PUT完整接收六组和可空comfort_notes，携带strict int≥0 expected_version，extra forbid。数组每组有界（最多32项、单ID最多40字符），目录未知项拒绝；同组重复规范为集合，喜欢/避免交集在对应字段返回422。body不接收owner、scene或修订号。
- 依既有 `route→service→repository→model`；PUT同Session transaction → account revision锁 → 本人preferences锁/refresh（存在时）→ version校验 → 写全部值/version → preferences_revision++ → 冻结DTO → commit。首次写由账户锁与主键收敛，不使用单独并发路径或外部调用。
- 版本冲突409，非法输入422，未认证401；失败回滚偏好与revision。提供受控仓储读取出口供后续推荐在同一账户一致读中消费，不新增跨服务ORM或泛化BaseService。

### 客户端与恢复

- 新业务偏好页及feature，从 `pages/business-settings` 接入；保留模板 `pages/preferences` 的外观设置职责。复用WardrobePage/Chips/现有语义Token与本人的wardrobe-options查询，不复制目录或另建按钮体系。
- 使用提供方生成PreferencesView/Put及唯一请求传输；查询按用户/代次隔离。初始化一次草稿固定version，六组为可清空的多选；分组交集原地提示，保留双方输入；comfort_notes使用实际Textarea能力。
- PUT结果未知先GET核对规范内容和版本；相同内容且版本已推进可确认结果，仍为原版本才重试原PUT，其他变化提示冲突。未知期间不另换payload；每个await后检查session/signal/页面存活，已完成后返回失败只重试导航。冲突重读不自动改版本或草稿。

## UI 实现依据

消费[偏好设计记录](../../../miniprogram/design/wardrobe-ui-ux.md#穿搭偏好)及[业务UI](../../../miniprogram/design/wardrobe-ui-spec.md)。当前源SHA256 `98404673fa82e8955f6b07916eb91fa079feed9f27361054c8599450644f8494`，`OgxoN/Z8EEvN`；喜欢场合 `UIbzM`、避免场合 `ViP2f`、舒适度 `ZXGcF/Xvrue`及说明`g1W4w`、固定保存/安全区。当前完整内容841px与644px视口为设计依据，运行时按真实宿主滚动和键盘适配，不能固定复制设备状态栏。

UI任务通过design-to-code实读当前源、递归Chip/Textarea/Button与变量、主题并prepare；实现者保持源只读，严格字体绑定沿用户Plan例外pending。舒适度区说明其自由文本仅供AI参考、不保证满足，并与结构化避免项的严格排除区分；实际推荐消费由后续Change验证。

## Risks / Trade-offs

- [首次保存与已有账户并发] → account锁+owner主键、版本0语义，真实PG竞争检查。
- [偏好与revision部分提交] → 同一事务与失败注入，不引入异步双写。
- [未知结果或切号后污染] → 原payload/版本与逐await检查，真实Query Observer及迟到微任务回归。
- [多组选项与固定保存区挤压] → 流式分组/触控/独立footer/语义主题静态核对，实际宿主与视觉待验。

## Migration Plan

基于实际head `5dbf2ea7379b` 在本任务隔离PG autogenerate新表与preferences_revision，检查旧profile/衣物/历史及两种revision保留，旧账户新修订为0。不回填虚构偏好，不清库，不自动部署；降级不得删除已保存偏好，需要另有保留数据的回退方案。
