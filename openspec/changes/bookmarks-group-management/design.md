## Context

M1 已 code-verified，采用 [正式技术方案](../../../docs/architecture/bookmarks/overview.md) 的已有表/UUID/复合 FK、用户锁、回执与 resolve。原三个 P2 均关闭，M1 验证记录仍为有效前置。

## Goals / Non-Goals

本 Change 交付分组维护、归组保存/编辑及联合查询的端到端能力。批量移动仍归 M3；不生成新设计或重写收藏主路径。

## Decisions

新增 POST/PATCH/DELETE `/api/v1/bookmark-groups` 路由，MutationResult 扩展 `group_create/group_rename/group_delete`，OperationResult 同步；DTO 其余字段不变。名称沿方案 ASCII name_key，数据库唯一约束兜底；复用 title/note 的 NUL 存储校验。删除带 expected_count，锁内核对后同事务更新组内收藏 group_id/time 与删除分组，返回实际 changed_count；数量变化 40912 先刷新确认内容。

### UI 实现依据

引用 [同一设计交付](../../../docs/design/bookmarks-design.md)，Pen SHA `234a29969acacf918dd86d0e80bc5d30865c4077d5becd3d139e28dc6f1feb66`。使用 `ALjzf/HDGhN`、`ALjzf/WODao` 分组删除槽、`frGCk/U596kS` 分组过滤与表单 Select、`XGUVa` 空分组/菜单、`mJdGV` 分组选择、`I5Qsg` 失败/unknown。UI tasks 2.1–2.2 实际加载 design-to-code 并执行只读来源 prepare/CAS；沿公共 Input invalid、Button loading、Dialog 组合，不复制弹窗。

## Risks / Trade-offs

同名并发、组删除与收藏新增/编辑竞争须真实 PG 证明；名称回滚不能丢 failed 回执。前端成功回执的 kind/runtime parse、metadata recovery 和 sessionStorage 必须兼容新动作，且保留已修复实例/operationId guard。

## Migration Plan

复用 M1 已迁移表，不需要重复迁移或修改既有业务数据；验证模型/schema 无漂移。

## Open Questions

无未决产品事实；M1 隔离 PG 与恢复结果提供本阶段代码验证，手机分组管理在既有内容入口承载。
