# 实际穿着记录｜检查证据

当前Change为code-verified，人工验收pending；阶段状态以manager/progress为准。

- 已用原生 OpenSpec 1.13.1 生成当前 Change 的 proposal/specs/design/tasks；`openspec validate wear-history --strict --no-interactive` 通过，8 项任务的 apply 为 ready。制品校验不代表业务实现通过，当前勾选状态以 tasks 为准。
- 依赖 M1 已 code-verified，既有隔离 PostgreSQL/Redis 与会话/媒体证据见[衣柜检查报告](../garment-management/verify-report.md)，不把它们算作穿着业务测试。
- 设计读取实际覆盖 `HI38Z/C0p2tC`、`tz4GK/RYACG`、`mKPcR`、`m0rZ7`、`SKORD`，递归 8 个引用组件及菜单 `z:AwJuH`、Light/Dark 变量；5 个目标两主题共 10 图已原生导出并查看，另有 Pillow decode。Dark 在独立 helper 内存切换页面及内容源，未保存原稿。读取前后源稿/公共库 SHA 一致。
- 新 `cache_flow.py prepare` 已按真实页面/局部 viewport 执行，最终仅字体资源缺失、pin=null；按用户本 Plan 例外继续，未声明已绑定。局部初始 viewport 沿用错误已修正后定向执行，不把错误条件当作有效依据。
- 原始临时证据：`/tmp/wardrobe-wear-current-native.json`、`/tmp/wardrobe-wear-menu-native.json`、`/tmp/wardrobe-wear-current/{light,dark}/`、`/tmp/wardrobe-wear-prepared-<PAGE_ID>.json`；当前持久设计来源及节点见 [design.md](design.md#ui-实现依据)。临时图不作为已接受的历史基准。
- Backend 提供方 schema/API 已冻结，原生 OpenAPI 导出与小程序类型生成成功；公开 DTO 为 `WearCreate/WearCreated/WearPatch/WearItem/WearView/WearList/WearDeleted` 及 `GarmentDetail`。提供方与客户端生成物漂移检查通过，小程序消费该实际契约。
- `tests/test_wear_history.py + tests/test_garments.py`：13 passed，真实 HTTP/SQLite 规则检查；`tests/test_wear_postgres.py`：12 passed、12.08s，无 skipped。后者验证迁移/旧 revision 回填及 Alembic check、同键/版本竞争、编辑删除和删除旧 POST 双方胜出、改衣物与保存快照双方胜出、收据/创建/修改/删除 revision 故障原子回滚。18 个受影响 Backend 文件 Ruff/format、架构和 diff 检查通过。
- 迁移 `d6ec6e2bad7c` 接 `85b26bb544ee`，在本任务 UUID schema autogenerate，补齐既有表 history revision 非负 CHECK（Alembic 未自动比较该 CHECK），拒绝破坏性 downgrade；未操作业务库。
- 协调者新增并执行 `tests/test_wear_api_postgres.py`：1 passed、1.05s，无 skipped。使用显式 `WARDROBE_TEST_DATABASE_URL` 专用 55432/wardrobe_test 与 `WARDROBE_TEST_REDIS_URL=redis://127.0.0.1:56379/14`，真实路由/认证/PG/Redis 完成微信交换替身→衣物/归档→去重补录→快照→改名/更正→删除/旧重放→次数→跨账户/撤销链。fixture 只清自身 UUID schema/随机 Redis 前缀；未调用真实微信。
- 该整链的非凭据真实 data 已显式导出 `.tools/manager-runtime/wear-consumer-responses.json`，供客户端 decoder 联检；不含 token/code 或完整请求。此产物是临时检查输入，不是产品数据。
- 协调者将真实响应原样交给当前客户端 `parseWearCreated/Record/List/Deleted` 与 `parseGarmentDetail`，临时 `tests/.manager-wear-consumer.test.ts` 的 2 项 Vitest probe 通过：unknown category、保留旧快照、编辑 version、删除空列表和 1→0 次数均正常解码。使用后已移除临时 probe，未手写生产 DTO 或以假响应代替真实接口。
- 独立 Reviewer 已审查稳定 Backend、迁移、上述新增整链与测试断言，无剩余阻塞。自查修正了仓储层构造 schema 的分层问题，公开 DTO 不变；未重复运行无疑点测试。
- 小程序记录列表/详情/补录修正、本人全状态分页多选、稳定创建与未知 PATCH 恢复、DELETE、真实衣柜/记录导航已实现。历史名称/类别用快照，照片只读当前本人媒体；详情 count 不被状态 PATCH 基础实体覆盖。Sheet 多选完成区和页面操作/主导航与滚动内容分区，静态核对两主题/Token/空错忙/触控，不宣称真机效果。
- 客户端最终 `tests/wear-history.test.ts` 15 项及 `tests/wear-selection.test.ts` 2 项通过；此前 8 个相邻文件合跑 74 passed，此后仅增加/复验 4 项竞态，范围重叠不累加。受影响 typecheck、ESLint/Prettier、tokens:check、contracts:check 和 diff 检查通过。
- Reviewer 发现未知 PATCH 恢复 GET resolve 后的会话竞态，已在 await 后复核 session/signal，新增同步栈切号/取消两项回归并定向复查通过。协调者自查的删除失效重取后导航及保存 fallback 同类边界已修，新增两项真实导航 helper 竞态通过，最终 UI/新增 diff 独立复查通过，无剩余阻塞。成功保存后重复 save 直接返回已完成收据，导航双失败不重发 API，有生产 editor/helper 测试证据。
- 偏好源稿修订仅影响 `Z8EEvN`；实际全树比较证明 wear/M1 节点及公共库不变。写前/后缓存回执闭合，客户端已在当前 `ad0a968...f9b577` 保存版对五个目标真实 prepare 重观察，未重复导出未变图片，仍仅字体缺失、pin=null；严格字体 binding 不声称通过。
- 字体严格绑定、宿主运行、视觉及产品验收 pending。无浏览器、build、外部模型调用或业务环境迁移。
