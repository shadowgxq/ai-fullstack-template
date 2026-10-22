# 账户与个人资料｜功能设计

关联：[总体方案](../overview.md) · [衣柜媒体](wardrobe.md) · [城市与天气](../integrations/weather.md)

## 1. 用户流程

用户主动微信登录，成功后进入自己的衣柜；同一微信身份再次登录仍对应原 User。头像、昵称和城市可以选择性设置，不影响基本使用。退出后不再展示上一账号的数据。

**登录主流程**：小程序 `Taro.login()` 获得临时 code → Backend 调微信 `code2Session` → 按 `(app_id,open_id)` 查找或创建 User → 签发既有 JWT → 小程序保存成功后进入登录态并读取 profile。

## 2. 身份、资料与接口

| 对象或接口 | 实现要点 |
|---|---|
| `users` | 继续使用现有整数 ID 作为资源 `owner_id`；已有账号密码登录保持兼容 |
| `wechat_identities` | `user_id, app_id, open_id`，唯一 `(app_id,open_id)`；不按 unionid 自动合并账号 |
| `user_profiles` | `user_id` 唯一，`nickname?、avatar_media_id?、city_id?`；不存储个人时区 |
| `POST /api/v1/auth/wechat` | 输入 `{code}`，服务端交换微信身份，返回原有会话凭据和本人标识 |
| `GET/PATCH /api/v1/profile` | 获取/修改可选资料；头像引用本人 ready 的 avatar 媒体，城市使用已验证 ID；请求不接受 `timezone` 字段 |
| 原有退出接口 | 复用 token 撤销，客户端同步清除本人会话与缓存 |

`users.password_hash` 需迁移为可空；微信新用户由服务端生成唯一技术用户名，但不能因此走密码登录。密码校验必须显式处理空 hash，旧账号保持原行为。`user_profiles` 独立存放，避免扩展字段依赖现有仅缓存旧 User 字段的对象；资料不要在 User 与 profile 中双重维护。

首次创建 User 和微信身份在一个事务内完成；相同身份并发登录以数据库唯一约束收敛。微信 code 交换在事务外执行，不记录 code、AppSecret 或原始 session_key，也不接受客户端提供的 openid。

## 3. 客户端状态及关键异常

- 未完成 token 持久化前不进入已登录态；登录失败、取消或微信 code 过期时可重试，但应重新获取 code。
- 按 `user_id + session_generation` 隔离 Query 缓存、草稿、当前推荐及图片临时缓存。退出/切号/401 时清理当前数据，旧请求迟到不得重新显示。
- 退出时先尝试服务端撤销；若撤销失败，仍可清理本地状态但明确提示未确认远端撤销。若本地 token 删除失败，恢复逻辑必须遵守独立退出标记，不能重新使用旧 token。
- 资料提交失败保留草稿；头像必须经 [统一媒体上传](wardrobe.md#3-图片上传与访问) 获取有效 ID，不能直接保存外部头像链接。
- 城市属于个人设置；业务日期统一采用 `Asia/Shanghai`，不提供时区选择。具体选城/定位及天气缓存规则由[天气专项](../integrations/weather.md)负责；定位授权不是微信登录前提。

## 4. 验证重点

验证同一微信身份重复/并发登录只关联一个 User；旧密码账户仍可登录；跨账号访问任何业务资源都被拒绝；退出当前会话后缓存与迟到回包不能泄露旧数据；昵称头像为空不阻塞衣柜。微信真机及实际 AppID/域名/隐私配置属于接入验证，不由单元测试替代。
