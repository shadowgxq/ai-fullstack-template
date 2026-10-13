# M2 验证记录

状态：M2 / bookmarks-group-management 代码、阶段集成、独立审查及来源绑定通过；恢复上下文 P2 一次定向修复并复查关闭。产品/视觉 pending。

- 后端全范围 Ruff/format（46 files）、带专属 BOOKMARKS_TEST_DATABASE_URL 的 pytest：119 passed（API 59、M1 PG 12、M2 PG 9、旧 39）。同一隔离 PostgreSQL 14.24，无新迁移，alembic check 无漂移。
- 新 PG 用例实际验证 service 并发重名/failed 回执、删组与收藏 create/update 两个锁顺序、中途 runtime/真实 FK 异常全部回滚、非名称 IntegrityError 不误分类、真实 Bearer HTTP 保存到组→编辑归组→联合搜索→改名保序→影响变化拒绝→删除→未分组/resolve。
- 独立 Reviewer 对照真实 M1 baseline `/home/gxq/.cache/bookmarks-run-20261013/m1-baseline` 审新增 diff；M2 后端无具体问题，未重跑已通过检查。
- 后端 OpenAPI 生成及 --check、make docs（24 个脚本测试）、root 架构与 diff 检查通过。来源清单登记本次直接消费者和新增业务文件；HEAD 的 33 项旧漂移在当前仍有 31 项，无本次新增，未覆盖无关源码。
- 前端分组实现的 81 项相关测试、typecheck、lint、格式已通过。Reviewer 以只读状态探针确认：关闭的分组 unknown A resolve 到终态后，新的收藏 unknown B 可让旧分组草稿也显示 B 的恢复状态；已用无阻塞时的新动作入口统一清理旧目标，并保留 pending/unknown。三条跨动作回归及受影响 Workspace/ops/Page 共 46 passed，类型/lint/格式/diff 通过；Reviewer 定向复查关闭 P2，其余结论有效。
- Pencil MCP 显式路径读取到另一个项目，不能把旧观察记为新绑定；独立 headless CLI 已正确读取已确认保存版的九个根，以及七个所选 Frame、74 variables/themes、十二个真实公共组件。原始节点与先前真实 MCP 逐字段一致；无损编码传输避免 PTY 丢行边空格。只读且不切换用户画布，Pen/library SHA 未变。
- 来源证据 `/home/gxq/.cache/codex-bookmarks-design/m2-headless/binding-evidence.json` 与同目录 `source-evidence.json`：七个 saved-file stream CAS v1，最终 contextHash `ec4260539296bec44d35e5f7d06993088fa47df08af6b5fb4533b389d5f70c55`，implementationStable=true；14 pins 已释放，activePins=0。公共库身份修正为实际 `docs/design/design-system/core.lib.pen`，使用新 fingerprint，不假称旧 editor 绑定有效。
- 阶段集成复用本阶段真实 Bearer HTTP+PG 生命周期及联合筛选/恢复组件测试；稳定修复经独立复查，无未完成代码阻塞，释放 M3。
- 未修改 Pen、启动 dev/build 或运行浏览器，人工产品验收仍在最终位置。
