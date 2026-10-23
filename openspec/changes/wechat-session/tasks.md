# Tasks

## 1. Backend 身份与默认资料

- [x] 1.1 Backend 执行者在 `backend/app/models`、`repositories`、`alembic/versions` 实现可空密码、身份唯一约束与默认 profile，密码注册及迁移回填保持兼容；用迁移检查、旧密码/空密码/默认资料相邻测试验证。
- [x] 1.2 Backend 执行者在 `backend/app/services`、`api`、`schemas`、配置及相邻测试实现事务外 code 交换、并发身份收敛和本人 profile 路由；验证无效/超时/畸形交换、越权输入、安全 Redis 故障与旧接口回归，不调用真实微信。

## 2. 小程序登录与会话

- [x] 2.1 客户端执行者在 `miniprogram/src/shared/api`、query、auth 与直接调用者落实账户/会话代次、token 持久化、退出标记和统一清理；测试存储失败、远端撤销失败、启动恢复、迟到成功/401 和切号，旧个人数据不得恢复。
- [x] 2.2 客户端执行者通过 `design-to-code` 只实现 `asaVm` 微信登录页面及其 pending/错误/取消状态，沿 `design.md` 读取真实来源、Token 与组件 API；修改范围限登录页及必要共享宿主，检查类型、相邻测试与静态样式，保留现有模板能力，不改 Pen 或实现后续业务页。

## 3. 契约与跨端检查

- [x] 3.1 协调者在 Backend schema 稳定后导出根 OpenAPI 快照，再生成小程序类型；客户端接通微信交换与 profile 解析，验证提供方和直接消费者无漂移，更新仅受影响契约说明。
- [x] 3.2 协调者与 Backend 执行者在新建隔离 PostgreSQL 中验证从旧 users 迁移、相同微信身份并发登录唯一性及回滚无孤立账户；测试目标不得复用或清空已有业务库，结果记录在 `verify-report.md`。
- [x] 3.3 独立只读 Reviewer 审查本 Change 稳定 diff、契约和检查证据，协调者处理问题并定向复查；必要检查通过后回写 Change 状态，真实微信宿主/最终产品验收保持 pending，不启动浏览器。
