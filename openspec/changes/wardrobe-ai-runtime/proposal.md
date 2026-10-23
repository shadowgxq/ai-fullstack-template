# 穿搭推荐 AI Runtime

## Why

现有Runtime仅有确定性的echo.v1，不能执行真实衣柜候选的结构化推荐，也没有付费调用恢复或取消。按[PRD推荐规则](../../../docs/product/01-prd-draft.md#34-ai-穿搭建议)和[推荐方案](../../../docs/architecture/wardrobe/features/outfit-recommendation.md#5-ai-worker-与调用恢复)，需要先交付可独立验证的受信执行契约，再由Backend消费。

## What Changes

- 显式注册wardrobe.recommend.v1及严格冻结输入/结构化输出，保留已有echo.v1真实调用与旧Checkpoint恢复。
- 在既有单Worker、Run、命令和同连接Saver上实现prepare→invoke→validate，记录单次模型Operation、原始响应引用、版本及已知usage；sending无持久响应时报告unknown，不自动重发。
- 增加受信scope内取消接口、取消意图与终态竞争裁定，保留已完成结果，不发布取消后的迟到输出。
- 建立可选模型适配与版本化prompt/输出schema，配置缺失不连接模型、不阻断确定性工作流；关闭隐式重试与非法输出自动修复。

## Capabilities

### New Capabilities

- `wardrobe-ai-runtime`: 受信结构化穿搭执行、一次调用证据恢复、取消和终态保护。

### Modified Capabilities

无。当前main specs为空；echo.v1既有HTTP与Checkpoint行为作为明确兼容依赖保留，不另建队列或通用Agent平台。

## Impact

影响ai-service公开DTO/Run应用协议、静态注册、Worker/图、Store/追加SQL迁移、模型适配和包内资源、配置与相邻测试；协调者更新AI OpenAPI和唯一契约说明。覆盖AC-006/009/010/012/025的执行职责，Backend owner授权、库存硬过滤、天气与最终理由由后续outfit-recommendations实现，本项不连接业务数据库。

以真实隔离PostgreSQL、API/单Worker/Saver、故障注入和模型边界替身验收代码；不调用真实模型、不运行浏览器或业务服务。真实模型结构化输出兼容性、usage和生产凭证条件另列待验。
