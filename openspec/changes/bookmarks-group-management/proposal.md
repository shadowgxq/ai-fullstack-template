## Why

在 M1 已验证的收藏闭环上交付 PRD 3.3 的分组整理，并完整接通 PRD 3.2 的分组与关键词联合查找。

## What Changes

- 创建空分组、重命名及原子删除分组 API 与共用名称表单/目标确认。
- 名称修剪/长度/ASCII 不分大小写重名、固定名称与权限规则。
- 删除前影响数量确认；组内收藏全部迁入未分组并更新时间，总数不变；页面筛选/计数/越界回退与失败/unknown 恢复。

## Capabilities

### New Capabilities
- `bookmark-groups`: 私有一级分组维护及收藏归组查询。

### Modified Capabilities
无；复用 M1 bookmark-core 契约。

## Impact

当前后端收藏领域、前端收藏 feature/UI 与语言、生成 OpenAPI。依赖 code-verified M1；不接通 M3 批量移动，不改 Pen/Token。来源 [PRD](../../../docs/product/bookmarks-prd.md)、[技术方案](../../../docs/architecture/bookmarks/overview.md)、[设计记录](../../../docs/design/bookmarks-design.md)。CA3、CA2 联合查找/计数、CA1 归组保存/编辑及 CA5–7 的分组路径。
