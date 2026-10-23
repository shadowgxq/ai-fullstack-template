# Tasks

## 1. Backend 穿着事实

- [x] 1.1 Backend 执行者独占 wear 模型/仓储/schema/service/API、共享 revision/metadata/依赖装配及唯一迁移链，交付创建、快照、版本修改、删除墓碑与幂等；在相邻测试验证本人三状态、去重/异载荷、旧快照/新增快照、删除旧 POST、失败原子性、跨账号和北京时间午夜。
- [x] 1.2 Backend 执行者在同范围实现日期筛选/稳定游标、有范围内部历史摘要及真实衣物详情 wear_count，避免列表 N+1；通过真实 schema/API 和聚合回归验证修正/删除/归档后次数、未知快照、日期范围及游标绑定，不改统计页面或媒体保留规则。
- [x] 1.3 Backend 执行者在本任务隔离 PostgreSQL 基于旧 head autogenerate 并审查迁移，验证旧账户 history_revision=0、创建/编辑/删除竞争、改衣物与保存快照竞争、收据/revision 失败回滚；仅使用明确测试 DSN 和 UUID schema，返回命令与证据，不操作现有业务库。

## 2. 小程序记录路径

- [x] 2.1 客户端执行者按 design-to-code 实读 design.md 所选历史/表单/多选/确认/空态及真实组件/变量/主题，扩展现有业务宿主和记录共享展示，接通记录列表/详情/补录修正与衣柜真实主入口；静态核对 Token、固定操作、两主题、状态和路由，不改源 Pen 或创建假推荐/统计页。
- [x] 2.2 生成契约冻结后，客户端执行者实现 history gateway/decoder、DELETE、日期与多选草稿、稳定创建重试、固定编辑版本及删除确认；新增相关逻辑/组件事件测试验证完成才应用、取消保留、失败与冲突恢复、成功导航失败不重复写及退出/切号旧回包隔离。
- [x] 2.3 客户端执行者消费真实 GarmentDetail.wear_count，避免 status PATCH 覆盖详情 count；记录写成功失效本人历史、相关详情及下游前缀，检查真实 Query Observer/消费者一致性、受影响 typecheck/Lint/格式，保留宿主与视觉 not_run。

## 3. 契约、审查与阶段汇合

- [x] 3.1 协调者在提供方冻结后统一导出 OpenAPI/生成小程序类型，核对直接消费者及相关契约说明，验证迁移/真实 API 衣物→补录→编辑→删除→旧重放与次数刷新链，复用已通过 M1 证据，不手写生成物或重复全库测试。
- [x] 3.2 独立只读 Reviewer 审查稳定 Backend/客户端及集成新增 diff，修复后定向复查；协调者依据实际结果回写 tasks/verify-report/Plan，必要检查及审查全部通过才标本 Change code-verified，M2 仍待其他成员完成，字体绑定/运行/产品验收 pending。
