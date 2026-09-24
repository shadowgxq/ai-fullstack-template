# Frontend

标准代码来源：`shadowgxq/github-temp-private-repo@766eb2a` 的 `frontend/`，采用整体同步而非重新实现。来源清单和明确集成差异见 [同步清单](../scripts/frontend-source.json)；后续源码为本项目维护，清单记录同步时刻，不禁止业务扩展。

## 安装与检查

Node ≥20.19（CI/Docker 使用 22）、pnpm 10.33；精确版本以 package.json/lockfile 为准。

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev                       # localhost:5173，默认代理 backend:8000
pnpm typecheck
pnpm lint:ci
pnpm test
pnpm format:check
pnpm build
pnpm preview --host 127.0.0.1 --port 4173
```

`pnpm check` 汇总类型、Lint、测试与格式，只负责本端。Vite preview 仅预览静态构建，不提供开发 API proxy；联调使用 dev 或根 `make up-web`。整个栈命令见 [根 README](../README.md)。`pnpm format` 才改写文件。

## 基础能力与集成

路由为 `/`、`/foundation`、`/theme`、`/components`、`/components/:componentName`、`/login` 与 404。保留来源的同步路由配置、AppProviders、AppHeader/AppShell/AppFooter、组件演示、主题/i18n、分享、QueryComposer 和测试基础设施；基础能力页不是产品业务。

认证 UI 复用标准 AuthForm/LoginModal，通过 `features/auth/model/auth.api.ts` 适配当前 Backend：`/api/v1/auth/{register,login,me,logout}`，成功 code 为 0。用户名保持真实身份；注册后另行登录，失败不伪装建立会话；logout 成功才清理会话，失败保留身份并显示错误；旧 token 的迟到 401 不清理已经替换的新会话。`auth.capabilities.ts` 关闭后端未实现的邮箱验证码、Google、找回/修改密码入口。相关标准组件只保留为可选演示能力；显式开发 mock 不是生产失败回退。

`/api` 开发与 Nginx 生产代理均保留路径。API 超时默认 20000ms。Docker 延续本仓库 Nginx 非 root 静态服务，不携带来源的独立 Caddy/Railway 部署。标准 `index.html` 保留已声明的 Google Fonts 资源；默认无外部翻译代理目标、无 analytics 脚本；这些扩展需明确配置，当前 backend 未提供翻译服务。

项目规范唯一入口为 [前端专项导航](../docs/engineering/frontend/README.md)。本目录不另建 docs、Manager 或 Skills 副本。
