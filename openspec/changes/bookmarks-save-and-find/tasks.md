## 1. Backend（后端执行者；仅 backend/，真实 PostgreSQL 地址由协调者提供）

- [x] 1.1 实现三个模型、约束/索引及 Alembic 升级迁移，注册 metadata；不自动迁移已有库。
- [x] 1.2 实现收藏 CRUD、列表搜索/分页/计数及逐资源授权，符合正式方案 DTO；公开 schema 固定供前端消费。
- [x] 1.3 实现操作 key/hash、原子回执、failed 与 resolve 占位语义及用户锁；相邻 API/业务/隔离 PostgreSQL 约束与竞争测试证明行为。

## 2. UI（前端执行者；design-to-code；仅 frontend/；依赖固定 DTO，不修改后端）

- [x] 2.1 消费 design.md 所选节点与真实公共组件/Token，完成只读来源与缓存准备，新增收藏页面/路由/导航、手机顶栏与桌面/手机列表、备注/外链。
- [x] 2.2 在 features/bookmarks 实现 API 边界、搜索分页及账号隔离、共用收藏表单/删除窗口、loading/empty/stale/字段与业务错误、pending/unknown/resolve 状态；仅 M1 范围。
- [x] 2.3 增加上述正常/边界/失败/重复/迟到/换账号行为测试，完成项目 typecheck、受影响 ESLint/格式检查及必要直接消费者回归；静态 UI 规范核对不记为视觉通过。

## 3. Coordination（协调者；docs/contracts、当前 Change、manager/）

- [x] 3.1 生成并校验后端契约，同步直接消费者与导航/能力清单，核对 API 保存→搜索→编辑→重访→删除及恢复集成证据。
- [x] 3.2 完成必要前后端、真实 PostgreSQL、架构/文档检查及独立只读审查；写 verify-report 后回写 Change/M1，人工 pending；不提交或归档。
