## 1. Backend（原后端执行者，仅 backend/，依赖 M1/M2 已验证）

- [x] 1.1 扩展 batch_move schema/kind/router/service/repository/hash，源/目标全授权、原子变组与同目标时间保持，复用回执及 resolve，固定路由不被 UUID 路由吞掉。
- [x] 1.2 完成 API 与专属真实 PG 的失效/中途回滚/同时间稳定排序/重复 key/resolve/移动与删组编辑竞争、跨 M1–M3 Bearer HTTP 集成及大分组快照测试；必要后端检查和无模型漂移。

## 2. UI（原前端执行者，仅 frontend/ 与其来源 cache，design-to-code tasks 2.1–2.2）

- [x] 2.1 只读 prepare 当前批量区依据；接通合法 batch_move/null-resource 回执、当前页选择与全选/目标/移动/取消、筛选历史清选择、明确失败选择交集及原 unknown 意图恢复、成功刷新/页码校准。
- [x] 2.2 完成相邻逻辑/权限/延迟账号/筛选分页/失效恢复回归和 M1/M2 直接消费者检查，typecheck/lint/格式；最终新实现 CAS 并 release pins，不改 Pen。

## 3. Coordination（协调者，仅 docs/当前 Change/manager）

- [x] 3.1 生成与校验 OpenAPI，更新契约/实际能力导航和直接消费者来源登记，核对 CA1–CA7 的阶段集成及必要 docs/架构/diff 检查，记录既有源码清单例外。
- [x] 3.2 交独立 Reviewer 审稳定 M2 baseline 增量与最终集成，必要局部修复并定向复查；保存真实证据，M3 code-verified/人工 pending，不提交或归档。
