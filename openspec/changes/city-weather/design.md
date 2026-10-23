# 城市与天气｜实现设计

## Context

动机与范围见[proposal](proposal.md)，行为见[规格](specs/city-weather/spec.md)。正式方案为[天气专项](../../../docs/architecture/wardrobe/integrations/weather.md)（2026-10-22，SHA256 `e571b2d8560db6e6388c70e33c93f6693f794b97ba1ef2e418344e8806fd1219`）、[账户资料](../../../docs/architecture/wardrobe/features/account-and-profile.md#2-身份资料与接口)及[共享约定](../../../docs/architecture/wardrobe/overview.md#4-共享数据与接口约定)。

现有 profile 已有只读 city_id 和正版本，PATCH 使用 account→profile 锁序并冻结提交响应。当前迁移 head 为 `d174ff3dc01d`；账户鉴权/撤销依赖 Redis，不可由可选天气降级绕过。小程序已有按会话隔离的查询、资料编辑和业务设置，尚无真实城市/天气消费者。

## Goals / Non-Goals

交付可信目录、选城/定位、版本保存、本人 context 与公共日缓存组成的真实契约，并通过设置消费。推荐模块后续直接消费同一 context 和天气组件。此处不实现 AI、单独创建推荐占位页面或调用付费定位服务；不宣称已满足天气来源生产使用条件、实际微信定位或视觉验收。

## Decisions

### 可信冻结目录与来源解析

采用专项指定的官方移动搜索数据和 PC 层级目录的唯一一致交集，保存规范数据、哈希及来源 URL/抓取时间等元数据。使用受限字面量解析及可复核生成流程；不执行 JS，不使用手工小城市列表或每次搜索下载全部数据。同名地区保留完整层级；重复码、名称冲突及缺源条目排除并以实际 fixture 验证。

目录由 `weather_regions` 持久化，稳定 region_id 同时作为 city_id，weather_code 只用于固定天气 URL。搜索有长度/结果上限，返回带 mapping_version 的候选及有界游标；游标绑定查询、目录版本和既有签名规则。地理解析仅可按可信完整层级唯一匹配，不从电话/邮编或相似字符串猜行政码。旧 profile 城市若无法验证，仅在无本次有效选择时采用明确默认，不修改旧存值。

### 接口与事务

`GET /api/v1/cities` 返回候选 `city_id, region_id, weather_code, province, city, district, display_name, mapping_version` 及 `next_cursor`。`POST /api/v1/weather/context` 接受可选 city_id 或 `location {latitude, longitude, coordinate_system: gcj02, accuracy: fuzzy}`，互斥；空输入采用保存/默认顺序。返回 `context_id, region, selection_source, weather_date, valid_until, state, facts, missing_reason`，facts 的观测/预报结构服从专项；字段与 nullable 在提供方冻结后统一生成客户端类型。

无效显式城市或无法定位明确报错，不能伪装默认成功。固定 HTTPS 地图/天气请求均在业务事务外，限制超时、正文大小、重定向和重试；可选地图 Key 为空不阻塞核心启动，原始坐标与密钥不记录。有效地区天气失败仍保存不可变 missing context。读取本人 context 的服务方法重验 owner、日期及有效期，供 M3 使用，不新增无消费者的公共查询接口。

profile PATCH 扩展 nullable city_id，复用 expected_version 和原有锁序；可信目录校验在现有事务内完成，不在资料事务内访问网络，失败回滚全部字段。ProfileService 增加必要的地区依赖，更新实际调用者和测试，不保留绕过校验的可选 fallback。nickname/avatar 未提供仍保持原值；城市不影响 inventory/history/preferences revisions。

### 日缓存与所有权

复用现有 Redis 接口边界但分离可选天气缓存与必需认证。key、午夜有效期、日加七午夜 EXPIREAT、短期负缓存、随机 token SET NX EX 和持锁二次检查按专项实现。写入与释放原子验证 token 及业务日；网络后复核日界，失锁者不得发布。非持锁请求只有限等待，不能转为无限重复抓取。缓存故障仅在认证已经成功后有限直连；context owner 与私人选择只在数据库，公共 payload 不含用户/查询/坐标。

天气页解析校验请求代码和正文地区、发布时间与当日日期。实测页面的夜间/次日白天可能跨日，不能按 DOM 顺序拼成全天；没有观测时刻的空 `.sk` 不产生 observation。固定来源 fixture 与合成边界时钟分开记录，不将测试时间替身称为真实天气。

### UI 实现依据

消费[设计记录](../../../miniprogram/design/wardrobe-ui-ux.md#关键局部)及[业务 UI](../../../miniprogram/design/wardrobe-ui-spec.md)，源为 `miniprogram/design/wardrobe.pen` SHA256 `85d689c39066637d8fbc3e9c6ce74899f29d316059c566c0d8edb004da2f874c`；公共库 `frontend/design/core.lib.pen` SHA256 `82ac8d54e5ef9f4c717a15cf3d1c15fc495eb4df5340528bdee1c1232b5100f6`。

选中 NLCY6 城市弹层、fkIRs/XzsEz 设置入口，以及 P9tls/ZHXw9 中 `ZHXw9/kboZC/QUgPr` 天气区域。设计样例城市、气温及穿衣建议不作运行数据。任务以 design-to-code 实读组件/变量、导出主题与窄屏并 prepare；按已获 Plan 例外仅字体严格绑定 pending，源稿只读。

设置页接入城市弹层和可复用 WeatherPanel 的真实数据区；其视觉组件/层级沿用现有天气区域，不复制整张穿搭页或添加假 AI 按钮。M3 在穿搭页挂载同一 WeatherPanel。弹层实时搜索真实目录而非固定样例，显式选中即保存，主动定位只在点击时执行；先取得可核验地区，再用当前 profile 版本保存，天气缺失不影响成功保存。冲突保持所选地区和草稿，读取最新版本后才允许用户重试，不能覆盖其他资料。每个 await 检查 session generation、关闭与请求序号，旧地区事实不显示为新地区。

天气区域明确显示默认来源、日期、抓取/来源时间、观测/预报及缺失状态；不展示未经事实支持的穿衣意见。查询按会话隔离，关闭、退出、切号清理临时选择和定位结果。未成功持久化不得报保存成功。

## Risks / Trade-offs

- 来源目录层级发布时间较旧 → 仅采用可复核的一致交集并暴露版本，不冒称完整最新行政区划；后续更新需重新验证。
- 网页结构或地区不符 → 结构化 missing 与短期负缓存，不切换未批准来源或拼装事实。
- 同日缓存不实时刷新 → 显示源时间和自然日；次日失效后重新取得事实。
- 微信定位权限、地图 Key、来源使用许可未验证 → 以边界替身验证代码，真实接入与最终宿主/视觉保持 pending。

## Migration Plan

在当前唯一 head 后新增地区目录与本人 weather_contexts 迁移，规范数据版本与 migration 同步，保留既有 profile 和业务数据。仅在任务所属隔离 PG schema 升级并核对 Alembic check、旧数据及约束；生产迁移须另行授权。回退只移除本项上下文和目录，不改写既有资料或其他业务记录。提供方稳定后由协调者导出 OpenAPI/客户端 schema，再检查真实 HTTP data 的直接 decoder 消费。
