# Tasks

## 1. Backend 统计

- [x] 1.1 Backend 执行者独占 statistics schema/repository/service/API 及 dependencies/main 装配，实现同一 statement 的本人库存/类别/全量记录/单件次数/30日趋势与有界游标；以相邻规则/API测试验证三状态、未分类、空历史、单件0次/归档、owner、范围/零值、游标与失效恢复，不改既有写入产品规则或新增计数表。
- [x] 1.2 Backend 执行者用本任务隔离 PostgreSQL/UUID schema 验证真实衣物/记录增改删后统计、单SQL读快照/并发写入一致性、旧游标与revision/午夜、跨月闰日及鉴权链；运行受影响Ruff/架构检查，返回实际命令/证据，不连接现有业务库或新增迁移。

## 2. 小程序统计

- [x] 2.1 客户端执行者按 design-to-code 消费当前 design.md 的统计源/规则，实读 ywaWl/a7xEg 及真实组件/变量/主题并prepare，接通记录入口、统计页、范围/类别数量条/分段趋势/单件分页及空错忙恢复；静态核对Token/两主题/触控/固定区，不修改源Pen或新增假业务页。
- [x] 2.2 生成DTO冻结后客户端执行者实现decoder/查询、写后失效和旧游标重置，补衣物保存及状态修改的statistics失效，复用记录失效；通过日期/分段/零值/游标、实际Query Observer与退出切号测试及受影响typecheck/Lint/格式验证，不把样例值当产品数据。

## 3. 契约与独立审查

- [x] 3.1 协调者统一导出OpenAPI/生成小程序类型并检查直接消费者、相关契约说明及真实接口→decoder联检，复用前置事实/会话证据；结果记verify-report，必要数据检查仅使用明确隔离资源，不运行无变化全库检查。
- [x] 3.2 独立只读Reviewer审查稳定Backend/客户端/集成新增diff，问题沿本Change修复复验并定向复查；全部必要检查与审查通过才回写本Change code-verified，M2及字体binding/宿主/视觉/产品验收保持实际状态。
