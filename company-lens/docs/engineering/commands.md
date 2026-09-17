# 命令登记表

工作目录均为 `frontend/`，除非另有说明。下列前端命令来自现有 `package.json`；依赖尚未在本项目安装，运行结果均为 not_run。

| 用途 | 命令 | 前置条件与范围 |
|---|---|---|
| 锁定安装 | `pnpm install --frozen-lockfile` | 使用 package.json 声明的 pnpm；保留原锁文件 |
| 开发 | `pnpm dev` | 先核对数据源及 DEV_PROXY_TARGET，默认配置仍指向旧服务 |
| 局部测试 | `pnpm exec vitest run <test-file>` | 对应测试与依赖存在 |
| 局部 lint | `pnpm exec eslint <file...>` | 按变更文件指定 |
| 项目类型检查 | `pnpm typecheck` | 影响范围需要项目类型检查时执行 |
| 全量测试 / lint | `pnpm test` / `pnpm lint` | 非日常默认检查，按实际影响范围选择 |
| 构建 | `pnpm build` | 包含 typecheck，按交付范围执行 |
| 格式检查 | `pnpm format:check` | 脚本存在；纯文档任务默认只检查 diff |
| 聚合检查 | `pnpm check` | 暂不就绪：包含依赖缺失 manager/plan.yaml 的 workflow 检查 |

`pnpm test:unit`、`pnpm test:e2e` 和 `pnpm api:generate` 当前不存在。前端配置详见[运行配置](../../frontend/docs/frontend/guides/runtime-config-and-vite.md)。

## 后端待建立的命令

`ai-service/` 尚无 Python 工程，当前没有可运行的后端命令。D0 实施时登记真实的依赖安装、API 启动、lint/typecheck/unit、离线 OpenAPI 与前端类型生成脚本；Worker、应用迁移、Saver 初始化、replay 和数据库集成命令随对应能力加入。

安装版本、命令执行结果与环境记录在对应任务。浏览器、live 评估、迁移或部署不因为列入命令表而自动执行。
