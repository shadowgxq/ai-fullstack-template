# M1 验证记录

状态：M1 code-verified；必要代码/逻辑与阶段集成检查、独立审查通过。人工视觉/产品待最终验收。

## 后端

- 初始最终检查：`backend/.venv/bin/ruff check .`、`ruff format --check .`（45 文件）、带 `BOOKMARKS_TEST_DATABASE_URL` 的全 pytest：67 passed（旧 39、新 API 17、真实 PostgreSQL 11）。
- 独立 Reviewer `bookmarks_reviewer` 找到 URL 数字主机与 NUL 两个 P2；分别修复并定向复查通过。修复后 API suite 45 passed，Ruff/格式/差异检查通过；其余未变逻辑的原证据复用，不把定向 45 写为一次全库运行。
- 本任务独立 PostgreSQL 14.24：`postgresql+psycopg2://bookmarks_test@127.0.0.1:55439/bookmarks_goal_test`，数据目录 `/home/gxq/.cache/bookmarks-test-pg-20261013/data`。root 专门创建，loopback trust，无现有开发/生产数据；测试另外随机 schema 并已清理。
- 真实 `alembic upgrade head` 和 `alembic check` 无漂移。PG tests 覆盖 FK/唯一/RESTRICT/级联、failed 回执持久、未知/真实约束异常回滚、并发 key、resolve 两种顺序、共享读锁快照、1000 分组/500 收藏完整查询与排序。
- 后端 OpenAPI 生成及 `--check` 通过，`scripts/check_architecture.py` 通过。DTO 未因上述字段修复变化。

## 前端与阶段检查

- 前端项目 typecheck、受影响 ESLint/Prettier、9 文件 51 测试（新增 36、既有直接消费者 15）通过，差异检查通过。cover 搜索分页、safe URL/字段/DTO、连续提交、unknown/resolve、写成功刷新失败、对话框草稿与身份切换/迟到。
- 7 根 Frame 实际 MCP 只读 native/组件/变量前后观察未变；cache prepare、CAS binding version 1、14 个 pins release。证据 `/home/gxq/.cache/codex-bookmarks-design/m1-read/binding-evidence.json`，协调者已读摘要并确认 cache active pins=0。来源资格仅 observed-consistent。
- root `make docs architecture` 通过（24 脚本测试），后端 OpenAPI --check 通过。业务集成由后端真实 API 生命周期与前端 wire/状态测试共同覆盖；未宣称浏览器端到端通过。
- 额外 `scripts/check_sources.py --frontend` 存在 31 项未改文件的旧基线漂移。直接用 HEAD 内容及 HEAD manifest 重算，原有 33 项；当前 31 全属同一既有集合、新增漂移 0。本次 5 个业务集成源文件与 20 个新增前端文件已登记 provenance，不修无关旧快照。

## 当前剩余

独立 Reviewer 发现旧 Workspace 迟到回调会删除新 operation 恢复记录（P2），已完成一轮定向修复与复查：实例 epoch/alive 和 operationId 条件清理，新增三项卸载/重返/新 unknown journal 的回归；ops/Workspace/Page 22 tests、typecheck/定向 lint/格式通过。独立 Reviewer 最终结论为 M1 无剩余问题，确认新增真实 HTTP+PG 测试及依赖恢复。未运行浏览器或 dev/build；视觉/产品待最终人工验收。

- 阶段额外真实组合：`test_bookmarks_postgres.py::test_http_lifecycle_with_real_bearer_auth_and_postgresql` 1 passed，保留真实登录/bcrypt/JWT/Bearer/get_current_user，只覆写到本任务 PG Session，Redis 使用既有 FakeRedis；覆盖完整 HTTP 生命周期与账号隔离，未启动业务 server。独立 Reviewer 将看新增测试 diff。

- 最终来源重观察未变，CAS 均 version 2；新增 7 pins 已释放，active pins=0。增量证据 `m1-read/race-binding-evidence.json`，实现上下文 `b26733b7d2f49de3874870fa9ca549c2f58812befb9344f8b075d3a34239302a`。公开契约无变化，原未变检查复用。前后端三个 P2 各一轮修复均已关闭，M2 前置已释放。

## 2026-10-14 验收反馈修复

- 用户授权处理当前失败项；本Change涉及F-001/F-003：公共控件及顶栏手机命中区域、错误焦点提示。只调整既有Token和控件样式，不改变业务/契约或重绘Pen。修复1轮；原验收失败与截图保留在本地QA run `20261014-101205-67c8a9/before-repair/`。
- typecheck、定向ESLint（0 warnings）、Prettier通过；收藏/认证/顶栏8个测试文件61项通过。独立只读Reviewer `/root/acceptance_ui_fix_review` 对8个生产文件及最终暗色Token定向复查无阻塞发现。
- 仅重建并更新已授权本地frontend容器，镜像 `sha256:0e2649f17adaa71d6c32435cd07ad9bec2016fe057f9ae2fbb71b9e1e00b3f9b`；backend/PostgreSQL/Redis容器ID不变。Playwright真实复验TC-029的8组手机流程和TC-032通过；实测按钮/字段/顶栏命中44px，暗色选择器边界3.231:1，错误焦点Light/Dark 5.126/6.483:1。
- 本轮完整Playwright执行29通过、1次导航load超时、3个必需PG用例阻塞；超时TC-027按预算同版本定向复测1次通过，未修改其代码/预期。当前累计30用例通过、4阻塞（含Chrome真实200%缩放/文字放大）；不是整体产品通过。精确命令、当前源码摘要与清理见本地QA run的report/state及repair-1-version/proof。
- 后端代码未变；本次未重跑缺连接的PG门禁，不把历史PG记录冒充本轮通过。代码修复已复验，human_acceptance仍pending；未提交、推送或归档。
