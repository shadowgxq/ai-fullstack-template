# 衣柜与穿着统计｜检查证据

当前 code-verified，人工验收 pending。

- 原生 OpenSpec 1.13.1 已生成 proposal/specs/design/tasks，`openspec validate wardrobe-statistics --strict --no-interactive` 通过，apply ready、6项任务；不将制品校验当作实现检查。
- 依赖 `wear-history` 已 code-verified，事实/快照/次数/会话及真实PG/Redis证据见[记录检查报告](../wear-history/verify-report.md)，不重复执行未变范围。
- 真实源读取覆盖 `ywaWl/a7xEg`、概览/类别/趋势/单件/说明及真实库/变量。`F5dEqt` 仅将概览标签纠正为 PRD 的全量“穿搭次数”，趋势仍近30天；Pen native保存/独立回读、写前后缓存回执已闭合，根全树精确比较确认唯一文本差异。当前源 SHA256 `85d689c39066637d8fbc3e9c6ce74899f29d316059c566c0d8edb004da2f874c`；390 Light/360 Dark已实际导出查看，公共库/其他节点未变。
- 临时设计证据 `/tmp/wardrobe-m2-statistics-label-*`，当前节点/规范入口见 [design.md](design.md#ui-实现依据)。这不是实现视觉或宿主验收；字体 unresolved，严格 binding 沿用户 Plan 例外 pending。
- Backend schema/API 已冻结并由协调者导出OpenAPI、生成小程序类型；接口 `GET /api/v1/statistics` 接收 `garment_cursor/page_size`，实际 DTO 为 `StatisticsView/CategoryCount/DailyWearCount/WearTrend/GarmentWearCount/GarmentCountsPage`，未手写生成物。
- `tests/test_statistics.py`：5 passed。显式本任务 PG/Redis DSN 的 `tests/test_statistics_postgres.py`：3 passed、2.94s、无 skipped，包括完整真实HTTP衣物/记录写后统计与授权/撤销链、SH午夜/闰日/窗口外全量，以及服务端statement门闩竞争。PG测试实际通过pg_locks确认统计SQL等待时，另一连接提交归档与记录；原响应仍为完整旧快照，下一读全新且旧游标409。单SQL计数与owner/三状态/null/0次/修正删除断言均保留。
- 8个受影响Backend文件 Ruff/format、架构和diff检查通过；独立Reviewer已审查稳定Backend与真实检查证据，无剩余阻塞。无迁移、模型或异步计数表改动。
- 真实HTTP非凭据data保存于 `.tools/manager-runtime/statistics-consumer-responses.json`。协调者临时Vitest probe直接解码全部8种响应，首次2项失败，定位客户端同次数UUID升序校验与提供方降序契约不一致；修正为DESC并增加全0次/并列次数/混合大小写回归后，相同原样响应probe 2/2 passed（19:31:41，7ms），临时测试已移除。未改真实响应或削弱排序校验；[契约说明](../../../docs/contracts/README.md)已描述相同快照、口径及游标失效规则。
- 客户端最终定向28/28 passed（统计13、wear-history相邻15；与前轮范围重叠），typecheck、受影响ESLint/Prettier、tokens:check、contracts:check、diff检查通过；协调者 `python3 scripts/export_contracts.py --service backend --check` 通过。
- 独立Reviewer确认Backend、客户端逻辑/UI源码和契约一致。发现的唯一P2为概览字号引用未定义Token，已改用 `--mp-title-size`（实际24px），单文件Prettier/diff通过，Reviewer定向复查PASS，无剩余代码阻塞；纯样式修正未重复执行28项测试。
- 字体严格binding、宿主/实现视觉及产品验收pending；不运行浏览器、build、真实外部调用或业务环境迁移。阶段状态以manager/progress为准，本项通过不代替产品验收。

## 2026-10-23 工程收尾与交互复验

- 独立只读审查发现 AC-027 的 P2：统计页持续前台跨北京时间午夜后不刷新日期，旧分页仍显示昨天结束的近30天范围。已按日期隔离 Query、午夜切换第一页、回前台同步日期；原统计 prefix invalidation 仍覆盖所有日期，409 恢复精确绑定日期。
- 新 `tests/statistics-page.test.ts` 使用真实页面、React Hooks 和 TanStack Query，通过 fake clock 验证前台午夜、后台恢复、旧分页取消、切号与迟到响应隔离。定向7文件39项通过；独立 Reviewer 定向复查 PASS。
- 客户端最终 `pnpm check`：32文件232项通过，包含 Token/契约漂移、typecheck、Lint 与 Prettier；`build:weapp`、`check:dist` 通过。登录页只统一 shared/ui 导入顺序，原 CSS Modules 顺序冲突警告消失；保留依赖自身 punycode deprecation，不屏蔽警告。
- 本轮真实PG/Redis业务组合85项通过（包括统计、历史、媒体、身份、资料、偏好、天气和推荐）；相邻规则/HTTP消费者125项通过。不同组合可能与历史证据重叠，不累计全Plan测试总数。
- DevTools CLI 实际返回 `IDE service port disabled`；用户明确改为先完成接口和代码验收，宿主全流程 not run，视觉由用户验收。生产构建 API origin 为空，只作工程验证，不作为已联网客户端证据。
