# Runtime Config And Vite

本文档定义客户端运行时配置、Vite 开发服务器代理和生产拆包的稳定边界。

## 配置职责

配置按运行位置分为三类：

| 类型                | 命名               | 读取位置             | 是否进入浏览器代码 |
| ------------------- | ------------------ | -------------------- | ------------------ |
| 客户端运行时配置    | `VITE_*`           | `src/shared/config/` | 是，禁止放密钥     |
| Vite/开发服务器配置 | `DEV_*`、`BUILD_*` | `vite.config.ts`     | 否                 |
| 容器运行时配置      | `BACKEND_ORIGIN`   | `Caddyfile`          | 否                 |

- 业务源码不直接读取 `import.meta.env`，统一消费 `shared/config` 暴露的 typed config。
- `shared/config` 负责 trim、类型转换、默认值和非法值 fallback。
- 新增客户端变量时同步更新 `.env.example`、`src/vite-env.d.ts` 和 `shared/config`。
- 密钥、内部 token、生产代理凭据不能使用 `VITE_*`，也不能进入前端仓库。

默认客户端配置：

```text
VITE_API_BASE_URL=/api
VITE_API_TIMEOUT_MS=30000
```

## 开发代理

`vite.config.ts` 默认把 `/api` 代理到旧 product-server Railway 服务；`DEV_PROXY_TARGET` 可覆盖目标：

```text
DEV_PROXY_PREFIX=/api
DEV_PROXY_TARGET=https://ai-bershire-product-server-production.up.railway.app
DEV_PROXY_SECURE=true
```

- `DEV_PROXY_PREFIX` 默认 `/api`，必须以 `/` 开头。
- `DEV_PROXY_TARGET` 必须是 `http` 或 `https` URL；未设置时使用项目内配置的 Railway 默认目标。
- `DEV_PROXY_SECURE=false` 只用于本地自签名 HTTPS，不作为共享默认值。
- 代理不做默认 path rewrite；前后端路径不一致时在具体项目中显式增加 rewrite。
- 生产环境由网关、反向代理或部署平台转发，不能依赖 Vite dev proxy。

## Railway 与 Docker

Railway 服务的 Root Directory 必须指向包含 `railway.toml`、`Dockerfile` 和
`package.json` 的当前 `frontend/` 目录。`railway.toml` 中的
`dockerfilePath = "Dockerfile"` 相对此 Root Directory 解析；如果 Railway 服务以更上层目录
作为 Root Directory，需要同步调整路径，不能直接沿用当前值。

容器由 Caddy 提供静态文件和 SPA fallback。启用 API mode 时，部署环境必须设置：

```text
BACKEND_ORIGIN=https://<current-backend-host>
VITE_DATA_SOURCE=api
VITE_RESEARCH_DATA_SOURCE=api
```

- `BACKEND_ORIGIN` 是容器运行时变量，不使用 `VITE_*`，也不会进入浏览器 bundle。
- `VITE_DATA_SOURCE` 和 `VITE_RESEARCH_DATA_SOURCE` 在 Docker build 阶段写入静态资源；复制代码默认均为 `api`，这是旧服务配置，不代表新服务已接通。仅在离线开发或测试时显式设为 `mock`。
- `PORT` 由 Railway 注入，Caddy 默认回退到 `8080`。
- 当前项目预置 product-server Railway 地址作为开发代理与容器反向代理的默认上游；可通过 `DEV_PROXY_TARGET` / `BACKEND_ORIGIN` 覆盖。OAuth 等公共标识由实际运行环境提供。
- `scripts/deploy-railway.sh` 从脚本位置解析当前项目根目录，因此从任意 shell 工作目录调用都不会改变部署上下文。

## 拆包规则

模板只维护少量稳定 vendor group：

- `framework`：React、React DOM、React Router。
- `data`：TanStack Query、Axios、Zustand。
- `ui`：Radix UI、Lucide。
- `i18n`：i18next、react-i18next。

未命中的依赖交给 Rollup 自动决定，不建立无限增长的 catch-all vendor chunk。只有满足以下条件才新增或拆分 group：

- 依赖体积明显，并且更新频率与业务代码不同。
- 模块确实进入首屏，稳定 chunk 能提升长期缓存命中。
- 通过 bundle report 证明拆分减少了重复下载或超大 chunk。

仅在用户操作后使用的编辑器、图表、导出等重型功能，应优先在业务代码使用动态 `import()`，不能只依靠 `manualChunks`。

生产 sourcemap 默认关闭；只有部署和错误监控策略允许时设置 `BUILD_SOURCEMAP=true`。
