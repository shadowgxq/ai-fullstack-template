# 小程序技术基线

## 当前实现

| 层 | 选择与边界 |
|---|---|
| 框架 | Taro 4.3.0 + React 18.3.1 + TypeScript，微信优先；不生成 H5/RN |
| 构建 | Webpack **5.91.0**，符合 Taro 4.3.0 runner 的精确 peer；不使用 `^` 自动漂移。所有 Taro 包同版本 |
| 依赖 | pnpm 10.33.0、独立 lockfile；Node 22。没有新增 workspace、全局 Taro CLI 或跨端源码导入 |
| 样式 | Sass + CSS Modules；375 逻辑 px 设计基准，关闭自动 pxtransform，流式布局承接宽度变化 |
| UI/路由 | `@tarojs/components`、原生页面/TabBar、原生导航；不复制 Web 公共 UI |
| 状态 | React 局部状态；Zustand 只维护外观偏好；TanStack Query 维护远端请求状态 |
| 网络 | `Taro.request` + schema/运行时解析；AbortSignal 对接 RequestTask；宿主缺失 AbortController 时加载轻量 polyfill |
| 契约 | 从根 Backend OpenAPI 快照生成端内 TS 类型，不把生成物视为另一份 schema 事实源 |
| 主题 | 共享 Web 色值生成 Reference，本端维护尺寸、语义及组件别名；系统/浅色/深色偏好 |

选型采用 [Taro v4.3.0 官方模板](https://github.com/NervJS/taro/tree/v4.3.0/packages/taro-cli/templates/default) 的 React/构建组合，裁剪无关平台、Git hooks 与重复工具链。Webpack 的锁定依据还包括 [runner package](https://github.com/NervJS/taro/blob/v4.3.0/packages/taro-webpack5-runner/package.json) 的 peer 声明；升级须作为一组依赖验证，不以安装成功代替生产构建。

## 代码边界

```text
src/app.tsx                 全局 Provider、网络/主题生命周期
src/pages/<page>/           原生页面注册与界面组合
src/features/<feature>/     当前业务规则；只有真实职责才建立
src/shared/api/             请求、错误、session、生成类型与 gateway
src/shared/platform/        微信能力与必要宿主适配
src/shared/query/           QueryClient 与非浏览器生命周期
src/shared/theme/           偏好、原生主题同步、生成映射
src/shared/styles/          生成色板与本端 Token
src/shared/ui/              本端基础组件公开出口
```

依赖方向为 pages → features/shared，features → shared；shared 不导入 pages、features 或 frontend。没有真实业务时不预建 entities、全局 store 或虚构领域。页面不直接接触 `wx`、数据库、AI 服务密钥，平台适配不反向依赖业务。

## 当前与扩展

已提供原生首页/组件/设置/登录、用户名密码 API 消费、主题偏好、媒体选择/上传适配函数与空/加载/错误表达。未提供微信 code2session 后端、账户绑定、支付、订阅通知、生产媒体存储或真实 AI 页面；不展示这些能力的伪成功入口。

本阶段未引入大型 UI 库、跨端组件库、自定义导航/TabBar、固定底部操作栏、BottomSheet、虚拟列表或分包空壳。真实需求触及这些能力时就近增加，并补宿主、状态和性能验证。现有 Web 继续使用 Vite，不要求两端打包器一致。
