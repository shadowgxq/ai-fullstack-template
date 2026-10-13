## Why

REQ-BOOKMARKS-001 的保存、查找与分组维护已在 M1/M2 代码验证，用户仍需要一次整理当前页的多条收藏。本 Change 接通批量移动并验证完整收藏路径，不增加新的产品范围。

## What Changes

- 增加认证内的原子批量移动 API，复用用户锁、幂等回执及 resolve；任何源或目标失效均不部分更新。
- 只对实际改变分组的收藏更新同一时间，同目标保持原时间；重放不会重复更新。
- 页面增加当前页选择、全选/部分选择、目标分组、移动和取消，筛选/翻页清选择；明确失败保留有效项，unknown 沿原操作恢复。
- 补充真实 PostgreSQL 竞争/回滚、直接消费者及跨 M1–M3 的 HTTP/状态集成；沿同一 Pen 增量消费并完成来源绑定。

## Capabilities

### New Capabilities

- `bookmark-batch-organize`：私人收藏当前页批量整理、原子性与恢复。

### Modified Capabilities

无；依赖当前计划中已 code-verified 的 `bookmarks-save-and-find` 与 `bookmarks-group-management`，不改写未归档的前阶段规格。

## Impact

受影响范围为 `backend/` 收藏领域和相关测试、`frontend/` 收藏业务及直接消费者、生成契约/来源登记和当前 Change/Manager 状态。无需新迁移，不改认证协议、设计稿或公共 UI。覆盖 CA4 并集成复验 CA1–CA7；真实产品/视觉仍归最终人工验收。
