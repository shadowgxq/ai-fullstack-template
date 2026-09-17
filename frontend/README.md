# Frontend

保留 React 18 + TypeScript + Vite、React Router、Query、Zustand、Radix、主题与国际化基座。业务需求不在本端重复维护。

Node 22、pnpm 10.33.0；在本目录执行：

```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
pnpm check
pnpm build
pnpm preview
```

开发端口默认 5173。`DEV_PROXY_TARGET=http://localhost:8000` 将 `/api` 转发到后端；`VITE_API_BASE_URL=/api`。`VITE_*` 公开到浏览器，不放服务 token。环境变量边界保留在 `src/shared/config/`。

`pnpm check` 包含 typecheck、Lint、测试、根 Manager/repairs 校验与代码格式；根文档用 `make docs` 校验。根 Compose 中使用 Nginx 提供构建产物和 `/api` 代理，访问 8080。启动命令见 [根 README](../README.md)，实现细则见 [专项导航](../docs/engineering/frontend/README.md)。
