# 前端迁入记录

> 来源：用户指定的 `ai-berkshire/frontend` 本地文件快照，迁入日期 2026-09-16；未取得可用 commit。

首次复制 373 个文件，身份见[迁入时 SHA-256 清单](frontend-import-manifest.json)。包含源码、public、测试、工程配置、锁文件、脚本与文档；排除 .git、node_modules、dist、本机 .env（保留 .env.example）、工具技能目录和缓存。

业务及工程运行代码保持复制基线。文档已按当前项目整理，前端 AGENTS 已移除，旧产品 PRD/分工和工具流程已归档；清单表示迁入时快照，不表示整理后所有路径仍存在。

## 复用与接入

用户确认复用现有样式、组件与交互，接口采用新 AI 服务规范。旧 API/DTO/mapper/事件层待替换，不要求新后端兼容 tasks/research-projects。

`vite.config.ts`、`.env.example`、`Caddyfile` 保留旧 Railway 默认代理；后续用 DEV_PROXY_TARGET / BACKEND_ORIGIN 明确指定目标。修改代理不等于接口兼容。预览旧 UI 时可显式选择 mock；配置说明见[前端运行配置](../../frontend/docs/frontend/guides/runtime-config-and-vite.md)。

依赖与运行验证见[项目状态](../project-status.md)和[命令表](../engineering/commands.md)。未取得独立许可文件，此记录不声明对外再分发授权。
