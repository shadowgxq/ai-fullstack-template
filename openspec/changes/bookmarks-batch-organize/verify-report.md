# M3 验证记录

状态：M3 / bookmarks-batch-organize 代码、阶段集成、独立审查与来源绑定通过。M1–M3 全部 code-verified；产品/视觉 pending。

## 检查与审查

- 实际 OpenSpec CLI 1.2.0，spec-driven 原生制品 strict validate / apply ready；不假称其他安装版本。
- 后端全范围 Ruff/format（47 files）、专属 PG DSN 下 `.venv/bin/pytest -q`：148 passed（旧 39 + API 72 + M1 PG 12 + M2 PG 9 + M3 PG 16）。alembic check 无新 upgrade，diff 通过。
- M3 真实 PG 覆盖全源/目标授权、部分 SQL 后 runtime/FK 异常回滚、同时间排序/no-op/反序 hash、resolve 两种锁顺序及反序重放真实等锁、移动与删源组/删目标组/编辑各两序、真实 Bearer HTTP 完整 M1–M3 路径。使用任务独立 loopback 55439 / bookmarks_goal_test 的随机 schema，认证复用已有 fake Redis fixture，不宣称真实 Redis 或部署链路通过。
- 复用未改的 M1 大集合测试：1000 组/500 收藏完整返回，all_count=500、ungrouped_count=250、999 个空组 + 1 个 250 正确。临时进程计时观察完整 list_bookmarks 为 20.922ms；这是本地单次值，不是生产 SLO，不新增测试副本或门槛。
- 前端 113 tests passed / 11 files（批量 15、API 25、ops 15、Page 5 和 M1/M2/header/router/auth 直接消费者），项目 typecheck、受影响 ESLint/Prettier、diff 通过。MutationResult type 通过 feature 公开；条件状态归属符合 React Hooks 规则，未屏蔽检查。
- Backend OpenAPI 生成及 --check、make docs（95 Markdown/24 脚本测试）、architecture 与 diff 通过。31 个业务文件登记及 5 个消费者 hash 匹配；逐一 HEAD 字节 hash 证明 source drift 的 HEAD 33/current 31 无本次新增，保留既有例外，不改无关源码。
- 独立 Reviewer 对照 `/home/gxq/.cache/bookmarks-run-20261013/m2-baseline` 审冻结前后端及阶段契约/架构/组件清单/源码登记，无具体问题。后端结论有效；前端最终两处 Token 修正已定向复查，无未关闭问题。

## 需求覆盖与阶段集成

| 条目 | 代码证据 |
|---|---|
| CA1 保存、编辑、删除与重访 | [核心 API/PG](../../../backend/tests/test_bookmarks_postgres.py)、[Workspace](../../../frontend/src/features/bookmarks/ui/BookmarksWorkspace/BookmarksWorkspace.test.tsx)，M3 真实 HTTP 生命周期集成复验 |
| CA2 查找、分页与独立计数 | [查询 API](../../../backend/tests/test_bookmarks_api.py)、真实 PG 共享锁/字面搜索/稳定排序/大集合；[批量 UI](../../../frontend/src/features/bookmarks/ui/BookmarksWorkspace/BookmarksBatch.test.tsx) 复验页码校准 |
| CA3 分组维护与迁入未分组 | [分组 PG](../../../backend/tests/test_bookmark_groups_postgres.py)、[分组 UI](../../../frontend/src/features/bookmarks/ui/BookmarksWorkspace/BookmarksGroups.test.tsx)，改名保序/40912 重确认与回滚 |
| CA4 当前页批量整理 | [批量 PG](../../../backend/tests/test_bookmark_batch_postgres.py)、批量 UI 15 项；用户导航清空、取消不写、成功刷新、明确失败自动校准保留有效交集 |
| CA5 账号与迟到响应隔离 | 三阶段真实 Bearer HTTP/资源权限， [Page](../../../frontend/src/pages/bookmarks/BookmarksPage.test.tsx) 和 ops 账号/实例/operationId guards |
| CA6 写入回执与异常恢复 | 全种类 replay/resolve、unknown 原 IDs/目标/key/三终态、失败保留与 saved-but-stale，M1/M2 仍有效证据复用 |
| CA7 UI 静态规范 | 真实 shared UI/Token、两主题/i18n 及响应式源码、单一恢复对象和共用表单/删除确认，源映射与适配如下；实际产品/视觉待验 |

## 设计来源与适配

- 同一已确认 Pen/PRD SHA 未变。独立 headless saved-file 真实 Get/GetVariables/十二个库定义，五帧 EapSM/I5Qsg/U596kS/frGCk/mJdGV 原始节点、bounds、74 variables/themes 前后观察一致；无损编码传输，不冒充另一个项目的 editor 修订。
- `/home/gxq/.cache/codex-bookmarks-design/m3-read/binding-evidence.json` 及同目录 `fresh-source-evidence.json`/`final-native.json`：五个 CAS v1，最终 contextHash `aff5c42b66ab9ac924f47d4214ea49ef0b9e7056226e1de745a98a66bf1606e1`，implementationStable/savedSourceUnmodified=true；10 pins 释放，activePins=0。
- shared 无独立 Checkbox，PageCheckbox 为就近业务原生 input，DOM indeterminate/aria mixed、global.css 的 --control-hit-size=44px 及颜色/焦点/间距/disabled Token 实际核对，不补公共库或依赖。
- BatchToolbar/选中行的两处同值 primary-subtle 修正为源语义对应、实际已导出的 bg-surface-selected；仅两处 class，定向 lint/格式/diff 通过，113 逻辑与 typecheck 复用，Reviewer 定向核对。
- 自有 headless session 92122 正常 exit，未 save，未切换或修改用户 Desktop。设计稿不重画。

## 验证边界

单阶段修复和检查均已关闭，无代码阻塞。前阶段 [M1](../bookmarks-save-and-find/verify-report.md)/[M2](../bookmarks-group-management/verify-report.md) 仍有效结果复用，不重复无关全栈或 AI 测试；根全量 make check/smoke 未运行，业务服务未启动。实际浏览器/视觉/部署 not_run。

PRD 6 及 1440/390、小视口/长文案、明暗主题、语言、键盘焦点、200% 文字、浮层滚动和完整个人路径均保持人工 pending。代码完成不等于产品 accepted；未提交、推送、归档或发布。

本任务专属 PostgreSQL cluster 已正常停止，数据/缓存保留；其它服务及用户 Desktop 未动。

## 2026-10-14 验收反馈修复

- 用户授权处理当前失败项；本Change涉及F-001/F-002/F-003：批量选择器暗色边界及公共控件尺寸/焦点修复。只调整既有Token和控件样式，不改变业务/契约或重绘Pen。修复1轮；原验收失败与截图保留在本地QA run `20261014-101205-67c8a9/before-repair/`。
- typecheck、定向ESLint（0 warnings）、Prettier通过；收藏/认证/顶栏8个测试文件61项通过。独立只读Reviewer `/root/acceptance_ui_fix_review` 对8个生产文件及最终暗色Token定向复查无阻塞发现。
- 仅重建并更新已授权本地frontend容器，镜像 `sha256:0e2649f17adaa71d6c32435cd07ad9bec2016fe057f9ae2fbb71b9e1e00b3f9b`；backend/PostgreSQL/Redis容器ID不变。Playwright真实复验TC-029的8组手机流程和TC-032通过；实测按钮/字段/顶栏命中44px，暗色选择器边界3.231:1，错误焦点Light/Dark 5.126/6.483:1。
- 本轮完整Playwright执行29通过、1次导航load超时、3个必需PG用例阻塞；超时TC-027按预算同版本定向复测1次通过，未修改其代码/预期。当前累计30用例通过、4阻塞（含Chrome真实200%缩放/文字放大）；不是整体产品通过。精确命令、当前源码摘要与清理见本地QA run的report/state及repair-1-version/proof。
- 后端代码未变；本次未重跑缺连接的PG门禁，不把历史PG记录冒充本轮通过。代码修复已复验，human_acceptance仍pending；未提交、推送或归档。
