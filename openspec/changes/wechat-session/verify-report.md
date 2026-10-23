# 微信账户会话｜代码检查

Backend、客户端会话及登录 UI 已完成必要代码检查和独立源码审查，当前 Change 为 code-verified。严格字体绑定依用户明确例外暂缓，仍未完成，不代表视觉或产品验收通过；旧客户端密码入口已清理并定向复查通过。

- 范围：`tasks.md` 的 1.1～3.3，PRD AC-010/022、默认资料 AC-023 和无个人时区字段 AC-027。
- 已执行：`openspec validate wechat-session --strict --no-interactive` 通过；Plan 结构检查通过。两项仅证明制品结构。
- 隔离资源：本次创建 `wardrobe-manager-pg-01a162fb`（`127.0.0.1:55432`，新 tmpfs 数据）和 `wardrobe-manager-redis-01a162fb`（`127.0.0.1:56379`）；task label 为 `01a162fb-3fdd-7c53-996b-71b23281c083`。`pg_isready`/Redis `PING` 通过，不复用现有 PricePilot 数据库。资源仅供本 Plan 隔离检查。
- Backend 检查：在 `backend/` 执行 `uv run --locked ruff check app tests main.py alembic` 与对应 `ruff format --check`，48 个文件通过；`git diff --check -- backend` 通过。相邻微信、认证、密码和 Redis 测试共 65 passed；仅收紧唯一冲突分类后的定向复验为 31 passed（27 离线及 4 个真实 PostgreSQL 测试，结果有重叠，不累加为独立测试数）。
- 真实基础设施：显式设置 `WARDROBE_TEST_DATABASE_URL` 为本次 `55432/wardrobe_test`、`WARDROBE_TEST_REDIS_URL=redis://127.0.0.1:56379/14`，执行 `uv run --locked pytest tests/test_wechat_session.py tests/test_wechat_postgres.py tests/test_auth_api.py tests/test_auth_boundaries.py tests/test_security.py tests/test_redis_safe.py -q`；唯一冲突分类修改后仅复验前两个文件。覆盖旧 users 升级与 profile 回填/旧密码、Barrier 强制并发首次未命中的唯一收敛、三表 flush 后注入失败的全部回滚，以及真实 API/PG/Redis 双账号本人资料→退出→有 TTL 撤销→旧 token 401、另一账户仍 200。微信外部交换为替身，不能视为真实微信通过。
- 隔离清理：测试仅创建/删除 UUID schema 和随机 Redis 前缀下的自身键，不执行现有库清空。Alembic 迁移已真实生成并在隔离环境验证；首次测试暴露 URL 编码的 `%` 被 ConfigParser 解释，修复转义后通过。
- 契约：Backend OpenAPI 与小程序类型已按提供方生成，两端漂移检查通过；客户端已消费微信会话与 profile，decoder 测试覆盖畸形输入，未手写生成 DTO。既有 Web 密码接口和 DTO 保持兼容，无新增 Web 消费接口。
- 客户端检查：`pnpm --dir miniprogram exec vitest run tests/api.test.ts tests/session.test.ts` 为 32 passed，`tests/session-storage.test.ts` 的 fresh-module 启动恢复为 4 passed；覆盖旧成功/401、旧退出与新登录交错、退出或页面失效后的迟到登录、持久化失败、退出标记与凭据删除部分/全部失败。`pnpm typecheck`、受影响源码/测试的 ESLint、Prettier、`contracts:check`、`tokens:check` 及 diff 检查通过。全存储失效不能保证跨进程持久退出，代码明确提示清理存储，并保持当前进程未登录。
- 替换清理后的当前证据：无生产消费者的 `api.login`、`Credentials`、密码校验 helper 及其专属用例已删除；Backend 原密码接口、安全检查和微信会话断言保留。API 18 + session 13 + startup-storage 4 = 35 passed，typecheck、受影响 lint/格式/diff 通过，独立 Reviewer 定向复查无问题。
- 设计来源：通过 WSL 原生 Pen CLI 读取 `asaVm`、完整 `z:j8DiT` 组件、52px 登录按钮实例、真实变量和库状态 `ok`，导出 390×820 Light 基准与两主题 shirt 资产。仓库 Pen 与导入库保持 `787cf0b` 无差异；临时内存文档切主题只用于导出，未保存仓库源稿。
- 缓存限制：实际执行 `cache_flow.py prepare`，补入真实组件资源后的结果仍为 `probe-source/dependencies-unresolved`，仅缺 `font:Inter`、`font:Noto Sans SC`，`pin=null`，未建立严格 binding。已核对当前原生读取 API，没有字体文件、URL 或加载状态读取能力；未以样式声明或渲染成功伪造字体事实，也未重复无变化尝试。临时证据在 `/tmp/wardrobe-session-cache-result-component.json`。
- 独立审查：Backend 与客户端会话及 UI 源码均未发现阻塞性代码问题，唯一冲突分类的定向复查通过；明确源码审查不能豁免严格 binding，也不能证明实际宿主视觉通过。
- 明确例外：2026-10-22 用户在本会话选择允许本 Plan 暂缓字体绑定并继续，基于真实节点、库组件和主题导出推进；binding 与视觉验收保持待验。未将字体声明或渲染事实伪造成字体资源，未改 Skill。
- 下一步：当前无剩余代码阻塞。登录返回来源页（无栈回模板 home），M1 衣柜 Change 接通真实衣柜入口后更新导航消费者；衣柜 owner/媒体不能用本 Change 的认证结果代替。只读取证 helper 已正常退出，临时证据保留。
- 人工待验：真实微信配置、平台登录/取消、导航、安全区及最终产品体验，均未执行。未运行浏览器、开发服务器或真实微信/模型调用。
- 修复：Alembic 测试 URL 百分号转义问题定向修复 1 次后通过；唯一冲突分类收紧后定向测试通过。默认 shell 未定位 `openspec` 通过选用已安装的 WSL Node 22 原生 PATH 解决，未升级全局工具。
