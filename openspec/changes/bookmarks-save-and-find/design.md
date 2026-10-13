## Context

当前 M1。引用 [技术方案](../../../docs/architecture/bookmarks/overview.md)、[PRD](../../../docs/product/bookmarks-prd.md)，用户 manager-run 现已授权全部计划代码阶段。前阶段确认与设计就绪见 manager/progress.md；不新增产品范围。

## Goals / Non-Goals

交付收藏保存与找回闭环、账号权限、防重复/结果恢复及真实数据库证据。分组维护和批量移动分别归 M2/M3，本 Change 仅建立其模型及查询契约，不启用未实现动作。

## Decisions

沿正式方案的 UUID 表、每账号数据库行锁、带幂等键写入、原子回执与 resolve 占位语义；API 信封与 DTO 由后端提供方生成。查询列表同时返回分页与全局分组数量，不维护客户端计数副本。前端沿现有认证/request/QueryClient/主题/i18n 与业务 feature 落点。

### UI 实现依据

[设计交付](../../../docs/design/bookmarks-design.md) / bookmarks.pen 保存版 SHA-256 `234a29969acacf918dd86d0e80bc5d30865c4077d5becd3d139e28dc6f1feb66`。
选取 `frGCk,U596kS,F8Q3b/XMjMl,wPuex,ALjzf/WODao` 收藏删除槽、`XGUVa` 空态/菜单/备注、`I5Qsg` 失败/unknown，及所用公共组件引用。UI tasks 2.1–2.3 必须加载 design-to-code，实际只读原设计和缓存准备；不复制 UI 任务正文或改 Pen。

## Risks / Trade-offs

真实 PostgreSQL 并发不能由 SQLite 证明；协调者提供本次隔离数据库，后端增加可复用夹具。用户行锁的吞吐限于个人操作场景，测试锁竞争与查询成本。网络丢失结果使用回执/resolve 而非新 key 盲重试。不会将静态检查记成视觉通过。

## Migration Plan

Alembic 新迁移只在本次隔离库执行升级与回归；不清理已有开发数据。应用回滚保留业务表，生产删除数据不属本次授权。

## Open Questions

无影响产品目标的未决问题；隔离数据库地址由协调者提供，真实运行证据由阶段检查落实。
