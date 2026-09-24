# Runtime Config And Vite

配置入口为 `shared/config/runtime-config.ts`；Vite 开发代理与拆包在 `vite.config.ts`。环境变量、示例与命令以 [frontend README](../../../../frontend/README.md) 和 `.env.example` 为准。

| 配置 | 当前行为 |
|---|---|
| API | `VITE_API_BASE_URL=/api`，超时 20000ms；鉴权 bridge 不反向依赖 feature store |
| Backend dev proxy | 默认 `http://127.0.0.1:8000`，`DEV_PROXY_TARGET` 可覆盖；prefix 默认 `/api`，不去除 `/api/v1` |
| Translation | 浏览器 base `/translation-api`；仅显式配置 `DEV_TRANSLATION_PROXY_TARGET` 才建立代理，没有外部远端默认值 |
| Auth | API 为默认；mock 只在显式开发演示模式使用，不在生产构建或错误时回退 |
| Analytics | 同时提供 `VITE_UMAMI_SRC` 和 `VITE_UMAMI_WEBSITE_ID` 才启用；默认无脚本和上报 |
| Build | target es2022；sourcemap 默认关；`@` 映射 src；React dedupe；Tailwind Vite 插件 |

`VITE_*` 在构建时进入浏览器，不能放密钥，也不能当作容器运行时秘密配置。`DEV_*`/`BUILD_*` 只由 Vite 读取，URL 必须 http/https；关闭 TLS 证书校验不是共享默认值。

vendor groups 为 framework、data、ui、i18n；未命中由 Rollup 决定。当前 Router **同步导入**页面，不能把 vendor 拆包写成路由懒加载。海报导出 adapter 保留来源的动态加载。

生产由本仓库 `frontend/nginx.conf` 提供静态文件和 `/api/` 代理，监听 8080；Compose 对外只绑定 loopback。Vite preview 用于静态启动检查，不承担 API 代理。生产公网的 TLS、授权、备份不由这份本地配置保证。
