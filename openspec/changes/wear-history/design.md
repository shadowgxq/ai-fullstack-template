# 实际穿着记录实现

## Context

动机与范围见 [proposal](proposal.md)。正式方案为 `623e964` 的 [总体 §4](../../../docs/architecture/wardrobe/overview.md#4-共享数据与接口约定) 与[记录专项 §2～3](../../../docs/architecture/wardrobe/features/wear-history-and-stats.md#2-数据事务与快照)。M1 已 code-verified，提供本人全状态衣物查询、私有媒体、账户 revision 锁、不可变创建收据和会话隔离；当前没有历史表、聚合或推荐来源模型。

## Goals / Non-Goals

**Goals:** 以一套穿着事实与共用表单交付手动记录和更正，提供统计/推荐真正可消费的查询与 history_revision。

**Non-Goals:** 不实现统计页面或推荐生成，不保存历史照片副本，不运行外部模型，不在现有业务库迁移或清数据。推荐来源字段与其授权随 M3 真实消费者接入；当前 API 不接受无法验证的推荐来源。

## Decisions

### 事务、快照和删除

- 新增 `wear_records`（UUID、owner、date、version、UTC timestamps）及 `wear_record_items`（record、garment、名称/类别快照，唯一 record/garment）；名称允许 null，支持仅照片衣物。
- 复用账户 revision 同一行，新增非负 `history_revision`，新旧账户初始 0；所有记录写入固定先锁账户，再按 UUID 顺序锁资源。与衣物修改使用同一账户锁，避免快照读取竞争。无需另一套历史锁或异步累计计数。
- 创建对衣物 UUID 去重/排序后计算 canonical payload hash，使用 `wear-record.create` 收据；记录、items、收据与 revision 同事务。修改保留既有 items 的原快照，新增才读当前值；仅改日期不改写已有快照，库存 revision 不变。
- 删除通过 owner 限定并检查 expected_version；移除明细及记录，同时保存 owner/record/删除时版本墓碑并增 history_revision。重复相同删除返回原删除结果，不增 revision；原 POST 收据仍在，但目标墓碑使重放明确 409。选择显式墓碑而非删除收据，防止响应丢失后重建事实。

### 日期、API 与聚合

日期由服务端 UTC clock 转 `ZoneInfo('Asia/Shanghai')` 得到今天；DTO 仅接收 ISO date，不接收设备时区或用户时区配置。日期筛选起止均为包含边界，反向区间 422。

| 接口（`/api/v1`） | 契约 |
| --- | --- |
| POST `/wear-records` | `{wear_date,garment_ids[]}` + Idempotency-Key，返回不可变 `{id,version}` |
| GET `/wear-records` | `start_date/end_date/cursor/page_size`，返回 `{items,next_cursor}`，按 `(wear_date,id)` 降序 |
| GET `/wear-records/{id}` | 本人日期、快照 items、version 和 UTC 时间点 |
| PATCH `/wear-records/{id}` | expected_version，日期/集合 missing 不变、null 不接受、空集合拒绝，返回当前记录 |
| DELETE `/wear-records/{id}` | expected_version query，返回本人 `{id,deleted:true}`；同次重试不误删其他记录 |
| GET `/garments/{id}` | 独立 `GarmentDetail` 在当前实体上增加真实 `wear_count`；PATCH 仍返回当前基础实体 |

游标沿用签名与 owner/筛选绑定模式，不复用衣物游标。内部历史摘要查询显式接受 owner 与日期范围，返回范围/固定时区、记录数、单件次数和最近穿着日，供后续真实推荐消费；不新增无需求公共摘要端点。聚合读取有效 facts，避免对列表逐行查询。当前衣物详情 count 从真实 items 聚合；客户端 status PATCH 不以基础实体覆盖带 count 的详情缓存，失效并重新读取详情。

### 客户端与共享影响

提供方 schema 生成小程序类型，decoder 校验实际日期/快照/版本/分页结果，增加 DELETE 边界。复用已验证 PendingCreate 的稳定身份与明确/未知失败区别，编辑固定草稿初始 version；保存已成功后，导航失败只能重试返回。所有查询/草稿与账户及代次绑定，写成功失效本人 history、garment detail 及后续统计/推荐的查询前缀。

选择器直接消费本人全状态分页衣物，当前状态不限制过去记录。草稿集合与弹层临时选择分开；完成提交选择，取消丢弃临时更改。真实记录列表提供操作菜单、修改和删除确认，复用快照列表供个人页后续消费，不复制另一份历史事实。当前先接通衣柜与记录的实际主入口，完整三 Tab 随真实穿搭页接入；不注册假推荐页或使用模板页面证明业务导航完成。

## UI 实现依据

消费 [设计交付：其他业务路径](../../../miniprogram/design/wardrobe-ui-ux.md#其他业务路径)、[业务移动 UI](../../../miniprogram/design/wardrobe-ui-spec.md)，来源 `wardrobe.pen@787cf0b`：历史 `HI38Z/C0p2tC`、表单 `tz4GK/RYACG`、多选 `mKPcR`、删除 `m0rZ7`、空态 `SKORD`。菜单依据真实 `z:AwJuH` 普通/危险项结构，其余状态复用现有 Button/Notice/StatePanel 及已确认规则。

UI tasks 按 design-to-code 实读所选节点、组件/变量及主题；2026-10-22 用户明确允许本 Plan 字体严格 binding 后移，其余来源读取不豁免。原 Pen 只读，源未变可复用有效取证，宿主/视觉与最终产品验收 pending。

## Risks / Trade-offs

- [删除与旧 POST/编辑竞争] → 共用账户锁、不可变收据和显式墓碑，真实 PostgreSQL 并发验证，不用 SQLite 冒充锁语义。
- [当前属性覆盖旧事实] → items 保留快照，服务只对新增项读取当前衣物；聚合仅依据有效明细。
- [详情 PATCH 缓存丢 count 或旧会话回包] → 更新直接 decoder/查询失效消费者，真实 Query Observer 或事件逻辑验证。
- [跨北京时间午夜] → 可注入 clock 验证边界，业务 date 与 UTC timestamps 分离。

## Migration Plan

Backend 执行者独占共享 revision/依赖装配、metadata 和唯一 Alembic 链，基于 `85b26bb544ee` 在本任务隔离 PostgreSQL autogenerate，审查 FK/索引/唯一约束和旧账户回填；迁移及失败/竞争检查仅操作 UUID schema。前向迁移保留用户和衣物，不能自动清库/清卷回退。生成契约由协调者统一导出，客户端再接冻结 DTO。
