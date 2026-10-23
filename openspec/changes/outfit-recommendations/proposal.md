# Proposal

## Why

已完成的私人衣柜、偏好、天气、穿着统计与可靠AI Runtime尚未形成推荐业务链，用户无法从库存获得可核验的穿搭建议并确认实际穿着。本Change补齐当前Plan最后一个业务闭环，避免把合法模型输出直接当作本人有效推荐。

## What Changes

- 增加本人推荐请求、同事务Outbox与独立投递入口，消费已冻结wardrobe.recommend.v1 Run API；投递在事务外，以稳定幂等键恢复远端已创建而本地未映射的Run。
- 全库存三值硬过滤、确定性软排序和可解释容量选择；冻结版本/偏好/近30日历史/天气和受控事实原子，支持空信息、少量候选及天气缺失。
- 提供生成/查询/取消、替换候选及完整组合校验；结果发布与读取重验owner、状态、revision和天气时效，拒绝非法事实、stale及取消后的迟到结果。
- 还原已确认Pen穿搭页/场景/替换与现有状态，复用天气与实际穿着表单；接通衣柜/穿搭/记录三主入口和个人设置。只显式保存实际穿着才写历史，失败保留草稿/幂等键并隔离旧会话响应。
- 同步提供方生成契约、真实客户端decoder、运行配置/命令和相关当前事实文档；保留模型/微信/视觉等真实接入与人工验收pending。

## Capabilities

### New Capabilities

- `outfit-recommendations`: 本人推荐从候选与可靠投递、受控发布到取消/替换/实际穿着确认的跨端闭环。

### Modified Capabilities

无；当前主spec inventory为空，已完成Changes的规则按实际契约消费，不改其业务要求。

## Impact

影响backend推荐实体/迁移、repository/service/API、AI HTTP消费者与dispatcher、必要配置/装配和直接相邻测试；miniprogram穿搭feature、主导航、共用穿着表单入口及真实API decoder；根生成契约/配置/必要文档。AI服务只消费已代码验收版本，不并行引入另一执行链，不访问另一服务数据库。既有业务数据/历史/媒体、设计源与公共库保留，不增加另一套AI执行或媒体存储实现。
