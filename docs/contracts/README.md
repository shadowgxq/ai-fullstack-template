# 跨端契约

提供方 Pydantic/路由为 schema 唯一事实源；[generated](generated/) 是提交的 OpenAPI 快照，不手工维护。`make contracts` 导出，`make contracts-check` 校验漂移。语义变化同步本文与直接消费者测试。

| 提供方 | 消费者 | 约定 |
|---|---|---|
| backend | frontend / 测试客户端 | `/api/v1/auth/*`；沿用 `{code,message,data}`；请求 ID 经中间件提供 |
| ai-service | 受信服务 / smoke 客户端 | `/api/v1/runs` 原生 DTO；Bearer token；scope 来自受信配置而非请求 |

AI 创建要求 `Idempotency-Key`（1–128 位非空白可打印 ASCII）与 `{workflow:"echo.v1",input:{text:"..."}}`。文本 1–2000 字，拒绝额外字段。排序 JSON 计算输入 hash，包含 workflow 版本。重复键同内容返回相同 Run 的当前快照，不同内容返回 409。

快照：run_id/workflow/status/input/output/error_code/last_sequence/created_at。状态 queued→running→completed 或 failed；未完成结果 409，跨 scope/不存在 404。正式结果不可覆写。`GET /api/v1/runs/{id}/events?after=0` 最多 100 条持久事件，以最后 sequence 续读、快照校准；**当前是 JSON 轮询，不是 SSE**。

AI 错误使用 FastAPI `{detail:...}`；验证 422、未授权 401、数据库不可用 503。客户端不读取 LangGraph State、数据库行或供应商原始输出。未来用户身份接入须定义受信 scope 映射，不能相信浏览器自报 tenant_id。

## 认证与字段错误

后端 JSON 登录使用 HTTP Bearer。401 返回 Bearer challenge；Redis 限流/撤销读写失败返回 HTTP 503、业务码 50301。缓存不可用仍可回源，不能复用缓存降级策略绕过鉴权。用户名与密码限制见生成 schema；密码另按 UTF-8 最多 72 字节校验。422 信封的 `data` 为 `loc/type/msg` 列表，不含 input/ctx；前端归一化保留为 `ApiError.details`。
