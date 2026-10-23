# 微信账户会话实现

## Context

依据当前提交 `623e964` 所含 [总方案 §4](../../../docs/architecture/wardrobe/overview.md#4-共享数据与接口约定) 与 [账户专项](../../../docs/architecture/wardrobe/features/account-and-profile.md)。既有 Backend 使用同步 SQLAlchemy、JWT/Redis 撤销及密码登录；小程序有 Taro code 适配、HTTP 信封解析与 QueryClient，但仍使用密码登录页，缺账户代次和持久退出标记。

## Goals / Non-Goals

**Goals:** 交付稳定微信身份、默认资料与可供后续功能复用的会话生命周期；保持认证 Redis 失败拒绝操作的契约。

**Non-Goals:** 不实现资料编辑、衣物 owner 或未就绪的业务导航，不进行真实微信接入、部署或既有数据重置。

## Decisions

- 复用 `users.id`、JWT 和旧密码接口，新增 `(app_id, open_id)` 唯一身份及每用户唯一 profile；`password_hash` 可空且密码校验显式拒绝空 hash。独立微信账户避免把技术用户名或 unionid 当作账号合并依据。
- code 交换在业务事务外，有界超时、无自动重试，服务边界注入可替换交换器。账户、身份与默认 profile 在一个事务创建；数据库唯一冲突回滚后读取胜者，只收敛实际身份竞争。
- `POST /api/v1/auth/wechat` 接受严格 `{code}`，返回 `{access_token,token_type,user:{id,username}}`；原密码 DTO 保持不变。`GET /api/v1/profile` 返回 `{user_id,nickname,avatar_media_id,city_id}`，后三项默认 null，媒体 ID 使用 UUID。不接受 owner 或 timezone。
- 迁移为已有用户补空 profile，密码注册同步创建默认资料，读取不隐式写入。资料只有 profile 一份事实源，不扩展旧 User 缓存对象。
- 客户端以 `user_id + session_generation` 标识本人作用域；请求捕获会话快照并在完成时比较。切换会话先失效旧请求和 Query；持久退出标记先于凭据删除。token 未持久化成功、并发登录过期及退出后迟到结果均不能恢复旧会话。

## UI 实现依据

只消费 [业务设计记录：微信登录与个人](../../../miniprogram/design/wardrobe-ui-ux.md#微信登录与个人)、[业务 UI](../../../miniprogram/design/wardrobe-ui-spec.md) 与当前 MCP 回读的 `H9XUdW` 未登录引导。登录中/失败复用现有 Button/Notice 状态及移动规则；登录成功进入本人衣柜，未登录页不显示私人内容或底部主导航。来源快照和必要检查见 [M1–M3 对齐记录](../outfit-recommendations/verify-report.md#2026-10-23-m1m3-当前设计对齐)。源稿只读，字体严格绑定和最终宿主验收 pending。

## Risks / Trade-offs

- [code 一次性且远端状态不明] → 每次用户重试重新取 code，不自动重放交换。
- [存储操作部分失败] → 先持久化退出意图，任何恢复路径检查标记；无法持久保护时显式报告失败，不伪造远端撤销。
- [SQLite 无法证明并发唯一收敛与迁移方言] → 以相邻离线 API 测试补独立 PostgreSQL 迁移和并发场景。
- [微信配置未核验] → adapter 替身证明业务边界，真实 AppID/Secret/合法域名和端上体验单独待验。

## Migration Plan

追加 users 可空密码与身份/profile 表迁移，已有账户回填默认资料。只在本次新建的隔离测试库执行；不迁移已有业务库。回退不得删除已产生的微信账户事实或以删表清库恢复，部署与实际数据回退另行决策。
