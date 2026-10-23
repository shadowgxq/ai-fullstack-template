# 衣柜与私有媒体｜检查证据

Backend、小程序和 M1 必要集成检查、独立审查均通过；本 Change 与 M1 为 code-verified，人工验收 pending。

## Backend

- 衣物与认证相邻测试 51 passed；媒体最终 16 passed；微信空配置与微信会话相邻 31 passed。范围存在重叠，不累加为独立测试总数。受影响 Ruff/格式、架构 import/事务边界、`uv lock --check --offline` 和 diff 检查通过。
- 迁移 `85b26bb544ee` 由隔离 PostgreSQL 上的真实 Alembic autogenerate 生成，接续 `5f4c7978c111`；审查四表、FK/约束/索引及旧账户 revision 回填，旧 head 升级成功，`alembic check` 无新操作。新密码/微信账户同事务初始化 revision。
- 显式设置 `WARDROBE_TEST_DATABASE_URL=postgresql+psycopg2://wardrobe_test:wardrobe_test_only@127.0.0.1:55432/wardrobe_test`、`WARDROBE_TEST_REDIS_URL=redis://127.0.0.1:56379/14` 后，在 Backend 运行 `uv run --locked pytest tests/test_garment_postgres.py tests/test_media_postgres.py tests/test_wechat_postgres.py -q`：14 passed，11.86s，无 skipped。包括本 Change 新增 10 项和前置微信 4 项。
- 实际覆盖：旧账户回填；同键创建竞争和同版本编辑竞争；收据/revision 写后失败原子回滚；媒体同键只产生一个结果；文件已发布但 ready 提交失败后复用同 inode；绑定与清理双方胜出；迟到 writer 不复活；真实 API/PG/Redis 的微信交换替身→上传→本人衣物/媒体授权→撤销，另一账户保持可用。各 fixture 仅删除自身 UUID schema 和随机键。

## 独立审查与修复

只读 Reviewer 审查 Backend 稳定代码和必要回归，提出并定向复查通过三项 P2：

- 清理候选在 LIMIT 前排除真实衣物/头像引用，锁内再检查，防止旧引用媒体使后续候选饥饿。
- 上传临时文件按媒体 UUID 归属，仅持同媒体文件锁清理；覆盖崩溃残留、其他媒体隔离与实际子进程 writer 互斥。
- Compose 显式透传 Backend 微信配置，空白可选凭据视为未配置，非空值不变；未配置返回受控 503，不发网络请求。

迁移补审通过。当前未发现剩余 Backend 阻塞问题；修复沿同一 Change，各问题一次定向修复后通过，未删业务验收或伪造依赖测试。

## 环境、配置与契约

- 本轮 Docker Desktop 启动因其残留 `dockerInference` 端点失败；未重置 Docker、删除旧数据或使用现有业务库。测试改用本任务独有 `.tools/manager-runtime/` 数据目录的原生 PostgreSQL 16.2、Redis 7.0.15，端口保持专用 `55432/56379`。执行前已实际验证服务版本、SQL 与 PING；它们不是生产接入证据。
- Compose 私有命名卷 `backend-media:/app/var/media`、目录权限初始化和 Git/Docker 构建排除已接线。实际 `docker compose ... config --format json` 校验媒体路径与微信配置键通过；未启动 Compose 服务、构建或部署。媒体卷备份仍需实际接入核验。
- Backend OpenAPI 和小程序类型已重新生成（含 PATCH status 的 missing/non-null 契约）；提供方导出漂移检查和小程序 `contracts:check`、直接 decoder/页面类型检查通过。

## 小程序与设计消费

- 在仓库根执行 `pnpm --dir miniprogram exec vitest run tests/wardrobe.test.ts tests/api.test.ts tests/session.test.ts tests/session-storage.test.ts tests/platform.test.ts`：5 files、59 passed。覆盖真实 Query Observer 筛选/分页、创建稳定重试身份、未知属性、认证媒体及退出/切号迟到响应隔离。
- `pnpm --dir miniprogram typecheck`、`tokens:check`、`contracts:check`，受影响代码/样式/测试/README 的定向 ESLint、Prettier 和 diff 检查通过。未执行 build 或启动浏览器。
- 最终 UI 审查指出第七项之后的颜色缺少当前值回显；已补主表单名称/勾选与弹层选中态，分类同步传入当前值，保留取消/清除。新增 `tests/wardrobe-choice.test.ts` 两项真实纯组件节点/事件测试覆盖选择→关闭回显→重开标记→取消保留→清空，连同原衣柜逻辑共 16 passed；受影响 typecheck、ESLint、Prettier、diff 检查通过。原 59 项与此范围重叠，未重复运行未受影响测试。
- 登录进入真实衣柜，衣柜/详情/添加编辑路由注册；详情三状态、归档确认与恢复、表单清除属性和折叠保留已接线。未虚构穿着次数，后续历史提供真实聚合。
- 保存成功先记录结果并锁定输入；后续导航失败只重试返回，不再 create/PATCH。该页面分支经静态控制流、类型与 Lint 核对，59 项测试未包含组件挂载后的导航失败模拟。
- 已实读 `wardrobe.pen@787cf0b` 当前任务节点、真实库实例/变量，并原生导出两主题；dark 导出在独立临时文档切换页面与内容源主题，原 Pen/公共库未保存修改。暂存原始证据为 `/tmp/wardrobe-garment-current-native.json`、`/tmp/wardrobe-garment-current/`、`/tmp/wardrobe-garment-prepared-*.json`，不作为持久产品资产。
- `cache_flow.py prepare` 实际返回字体依赖缺口，未取得有效 pin；按用户明确例外继续实现，严格字体 binding 与视觉验收仍 pending。宿主分区、语义 Token、Light/Dark、键盘事件/固定操作仅有源码证据。

## M1 汇合与待验

- 独立 Reviewer 已完成 Backend、迁移、客户端逻辑、最终页面/导航与新增 diff 审查，颜色回显问题一次定向修复后复查通过，无剩余阻塞。阶段复用真实 PG/Redis 授权链、迁移与媒体竞争检查、生成契约及客户端会话/页面证据，未重复执行无变化范围。
- 真实微信/媒体权限、宿主键盘/滚动/安全区、视觉与产品体验均未运行；字体严格绑定按用户明确例外暂缓，不声称通过。不运行浏览器、发布或归档。
