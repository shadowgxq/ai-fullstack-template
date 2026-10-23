# 衣柜与私有媒体实现

## Context

依赖 `wechat-session` 的实际账户、profile 与客户端会话。正式方案为 `623e964` 的 [总体 §4](../../../docs/architecture/wardrobe/overview.md#4-共享数据与接口约定)、[衣柜专项](../../../docs/architecture/wardrobe/features/wardrobe.md)。当前尚无衣物/媒体/库存 revision/收据实现；Backend 保持同步分层和 Alembic，小程序复用已完成的真实 session 与登录宿主。

## Goals / Non-Goals

**Goals:** 完整交付本人衣物、单张私有照片及失败恢复；冻结后续记录/推荐真正使用的版本、锁序与目录边界。

**Non-Goals:** 不实现历史、统计或推荐，不展示尚无聚合依据的穿着次数，不识图或永久删除衣物，不迁移现有业务环境或发布。

## Decisions

### 数据与事务

- UUID `garments` 保存批准字段、三种状态、版本和 UTC 时间戳；数据库兜底非空白名称或照片引用至少一项。未填可空字段为 null，多选为去空白/去重列表。服务校验目录稳定 ID；自定义标签为文本，不自动推断风格。
- `account_revisions(owner_id, inventory_revision)` 按账户一行，User 创建事务初始化，迁移回填旧账户。共享 `RevisionRepository.create/lock`，所有写入/媒体绑定/清理固定先锁账户 revision，再按 UUID 顺序锁资源；当前仅实现库存 revision，后续字段由真实消费者扩展。
- `idempotency_receipts` 唯一 `(owner_id, operation, key)`，存 canonical payload hash、resource UUID 与不可变响应。`garment.create` 在账户锁内检查，衣物/收据/revision 同事务；重放不增 revision，异 payload 409，不能靠 UI loading 代替。
- PATCH 使用 `expected_version`；missing 不变，nullable 字段 null 清空，数组仅 [] 清空。状态改变与属性写入统一版本/revision 边界，不复制专用归档存储。

### API 与目录

统一 `/api/v1`，沿用业务信封与本人认证。外部 DTO 由提供方 Pydantic 生成，小程序不手写平行类型。

| 接口 | 当前契约 |
| --- | --- |
| GET `/wardrobe/options` | `{version,categories,colors,seasons,occasions,styles}`，各组稳定 `{id,label}`；风格只供明确资料使用 |
| POST `/garments` | `{name?,photo_media_id?,category?,color?,season[],occasion[],tags[],notes?}` + Idempotency-Key，初始 wearable，返回 `{id,version}` |
| PATCH `/garments/{id}` | 上述可选字段、status 与必需 expected_version，返回当前实体 |
| GET `/garments/{id}` | 全部当前字段、id/status/version/created_at/updated_at；不返回 owner 或无查询依据的次数 |
| GET `/garments` | status/category/color/season/occasion/tag、cursor/page_size（默认20，上限100），返回 `{items,next_cursor}` |
| POST `/media` | 认证 multipart file/purpose（garment/avatar）+ Idempotency-Key，返回 ready `{id,purpose,status,content_type,size_bytes,width,height}` |
| GET `/media/{id}/content` | 本人鉴权后二进制，不公开 storage key 或外部 URL |

列表按 `(created_at,id)` 降序，多取一项生成下一游标；游标与 owner/筛选绑定，非法或换条件复用返回 422。衣物名、字段长度及目录范围在 schema/服务声明；未知值不默认填“其他”。风格与标签的关系只承认用户明确输入的目录 ID 或标签名称，不从类别或照片推断。

### 媒体恢复和清理

- 增加 Pillow 与 python-multipart，真实解码 JPEG/PNG/WebP、限制原始文件 10 MiB 及有界像素/尺寸，去除 EXIF 后重编码；防止扩展名伪装。配置私有根目录，在公开路径之外。
- 媒体 UUID 映射持久保存 owner、用途、上传幂等键、原文件摘要、规范文件摘要/尺寸和 `pending/ready/deleting/deleted` 状态。相同键只接受同用途/文件；deleted 保留重放墓碑，不能复活或换内容复用。
- pending 建档事务提交后，事务外临时写盘/fsync/原子发布，再短事务校验并置 ready。重试优先核对已发布规范文件；无法匹配时明确失败。外部 IO 不进入业务事务。
- 同一媒体的发布和删除用本地持久文件锁协调跨进程操作，避免 cleanup 完成后迟到 writer 再发布。文件锁与 DB 锁不得形成反向等待环；短事务遵守账户→资源顺序，不在 DB 锁内等待文件 IO。
- 后台 CLI 扫描过期未引用媒体，锁账户及媒体并核对 garments/profile 实际引用，先置 deleting 提交，再事务外删除，最后置 deleted；deleting 可重扫，失败不删元数据或丢掉重试线索。新增绑定只接受 ready；已引用媒体不清理。

### 客户端消费

请求边界最小增加 PATCH、幂等 header、认证 multipart 上传/下载；Bearer 仅送可信 origin。上传、图片临时路径和草稿均按账户/代次失效，底层任务可取消且旧回包不能写入新会话。媒体展示需认证下载后的临时路径，不把 API URL 直接作为公开图片。

表单对每次未完成保存保留幂等键，提交失败保持 payload 与重试身份；修改 payload 后使用新操作身份，响应丢失时先重试同次操作，不静默创建另一件。选图来源分别传 camera/album；移除及更换只改一张主照片，上传失败不清空其他字段。列表筛选清游标且隔离旧响应，写成功失效本人相关查询。登录最终跳转真实衣柜，模板组件演示以辅助路由保留，当前不注册虚假的未来业务页来宣称三 Tab 完成。

## UI 实现依据

使用 [设计交付：添加与编辑衣物](../../../miniprogram/design/wardrobe-ui-ux.md#添加与编辑衣物)、[业务 UI](../../../miniprogram/design/wardrobe-ui-spec.md) 与 `wardrobe.pen@787cf0b`。列表 `ddC69/zkPuC`、详情 `WV7wn/StjQC`、表单 `Ro2vL/FfxoI`、展开 `jxBYZ/Y8xJCl`，选择 `phKmP/zXmjy/kopCO`，确认 `m0rZ7` 与空态 `SKORD`。状态复用已记录 Button/Notice/StatePanel 与选择规则；不修改源稿。UI task 按 design-to-code 实际读取目标节点/实例/变量/主题并观察缓存，2026-10-22 用户明确暂缓本 Plan 字体严格 binding，仍保留字体 binding、宿主及视觉验收待验。

## Risks / Trade-offs

- [文件与 DB 无法跨系统原子提交] → 持久 pending、摘要核验、短事务重试与墓碑，故障注入验证实际恢复。
- [上传、清理和绑定竞争] → 固定账户/资源锁序、文件发布/删除锁、真实引用核验，PostgreSQL 并发与文件部分失败检查。
- [本地卷多进程/多机] → 支持共享该持久目录的进程，部署必须验证卷/备份；不暗示独立磁盘多机可用。
- [SQLite 不覆盖锁与方言] → 离线规则测试外，在本次隔离 PostgreSQL/临时媒体目录验证关键事务及竞争，不操作现有库。

## Migration Plan

串行生成并审查本 Change 模型迁移，回填 revision，保留微信/密码账户；只对本次隔离库执行。注册所有模型和新用户初始化路径，验证从 M1 前一 head 升级及真实资源权限链。持久媒体与数据库不能用清卷/删表作为回退，部署和备份另行授权。
