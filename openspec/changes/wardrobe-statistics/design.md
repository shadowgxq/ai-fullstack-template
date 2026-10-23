# 统计实现

## Context

范围见 [proposal](proposal.md)，消费 `623e964` 的[记录与统计专项 §4～5](../../../docs/architecture/wardrobe/features/wear-history-and-stats.md#4-统计口径)。`wear-history` 已 code-verified，提供有效 records/items、history revision、真实衣物详情次数及会话查询失效；当前没有统计接口/页面。Backend 保持同步分层，不能在鉴权已开启事务后假设设置隔离级别生效。

## Goals / Non-Goals

**Goals:** 一次读取形成口径一致的统计与有界单件列表，UI 使用真实范围和失败恢复。

**Non-Goals:** 不新增计数表/异步任务/迁移，不推断未记录穿着，不调用外部天气/模型，不替代产品与真机验收。

## Decisions

- `StatisticsRepository` 以一个 SQL statement 的 CTE/聚合子查询组合本人 garments、wear_records/items 及账户 revisions，返回内部标量/行；service 组 DTO、补齐30天零值。选择单 statement 保证 PostgreSQL 同一读快照，避免连续普通 Session 查询混合已提交状态，也不让 repository 构造公开 schema。
- `GET /api/v1/statistics` 沿用 Bearer/信封。响应包含 `wardrobe_total`、`archived_count`、`category_counts[{category,count}]`、全量 `wear_record_count`、`trend{start_date,end_date,timezone,days[{date,count}]}` 和 `garment_counts{items,next_cursor}`。单件行包含 `garment_id/name/category/status/wear_count`，含本人全部状态及0次衣物，名称/类别为当前值。
- 单件页默认20、上限100，按次数降序、UUID降序稳定排序；`garment_cursor` 签名并绑定 owner、统计日、inventory/history revision 及末行。数据或北京时间日期变化使旧页返回409，客户端重置第一页恢复；非法/跨账户游标422。每次分页响应本身仍由单 statement 的同一读快照产生，不维护长期服务端快照或增加无界数组。
- 日期复用北京时间口径，可注入 UTC clock，服务端今天及此前29日构成窗口。全量记录数与单件次数不被趋势窗口截断。类别 bar 表达相对最大类别的数量长度，文字始终显示真实数量；不把源稿示例条长解释成百分比。UI 可按源稿将30个日值分为7日一段、末段2日，必须标明实际区间。
- 查询按账户/代次隔离；`invalidateWearFacts` 已覆盖 statistics 前缀，衣物表单成功与状态修改补同前缀失效。旧游标冲突提供重新载入；筛选/重置取消旧响应。统计进入衣物详情继续读取真实单件次数，不缓存另一份累计值。

## UI 实现依据

使用[设计交付：页面定位](../../../miniprogram/design/wardrobe-ui-ux.md#页面定位)及[业务 UI](../../../miniprogram/design/wardrobe-ui-spec.md)，来源 `wardrobe.pen` 的 `ywaWl/a7xEg`；真实内容含概览 `mBny0`、类别 `BAbLM`、趋势 `AZBRE`、单件 `pjzf1`、说明 `hRV2a`。三条单件行是示例，运行时复用相同行结构和既有加载更多/空错忙规则，不推断固定数量。概览 `F5dEqt` 按已确认 PRD 表达全量“穿搭次数”，近30天范围归趋势；同源文字纠正已原生保存回读，当前源SHA256 `85d689c39066637d8fbc3e9c6ce74899f29d316059c566c0d8edb004da2f874c`；390 Light/360 Dark已查看，其他源节点不变。

UI tasks 通过 design-to-code 实读当前目标、真实库/变量/主题并 prepare；字体 binding 沿用用户 Plan 级后移例外，原生静态设计检查不等于实现视觉或宿主验收。共享宿主、Button/Notice/StatePanel 与历史入口使用真实小程序组件，不导入 Web 控件。

## Risks / Trade-offs

- [读取过程中事实变化] → 单 SQL statement；隔离 PG 验证一致读与写入竞争，不用 SQLite 证明方言快照。
- [次数排序跨页移动或跨午夜] → 已有 revisions/日期绑定游标，409时重置，不让旧页混入新响应。
- [库存和记录写后统计未刷新] → 补齐真实写入消费者，Query Observer 定向验证两类失效。
- [源稿样例值/范围被误作真实事实] → 显式 DTO与日期范围、相对数量条和零值，数据变化测试验证。

## Migration Plan

复用当前表与索引，无迁移。Backend 执行者独占 statistics 模块及 dependencies/main 装配；协调者统一导出 schema，客户端消费生成类型并注册页面。必要 PG 检查只用本任务专用 DSN/UUID schema，不操作现有业务环境。
