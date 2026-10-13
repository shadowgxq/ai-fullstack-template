## Why

REQ-BOOKMARKS-001 需要先交付个人资料保存与找回闭环。现有模板只有认证与组件展示，尚无收藏持久化与页面。

## What Changes

- 实现收藏新增、回填编辑、删除、备注查看、安全外链、列表搜索分页与个人权限。
- 新增三张目标表及迁移、计数快照、操作防重与结果未知恢复；分组表为后续真实分组写入提供契约，本 Change 不实现分组管理或批量移动。
- 依批准设计接入收藏页面、导航、手机顶栏、共用表单和错误状态，沿用主题与语言。

## Capabilities

### New Capabilities
- `bookmark-core`: 个人收藏保存与找回、分页/查询契约、幂等及结果恢复。

### Modified Capabilities
无。

## Impact

backend 收藏域、迁移/API schema 和生成契约；frontend 收藏 feature/page、路由、AppHeader 与语言资源。使用现有认证/PostgreSQL/React Query；不接入 AI，不抓取网页。依据 [PRD](../../../docs/product/bookmarks-prd.md)、[技术方案](../../../docs/architecture/bookmarks/overview.md) 与 [设计交付](../../../docs/design/bookmarks-design.md)。CA1、CA2 基础及查询契约、CA5、CA6 收藏路径、CA7；产品观感最终集中待验。
