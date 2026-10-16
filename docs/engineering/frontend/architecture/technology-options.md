# 前端技术基线

代码基线来自标准 frontend 的整体同步，来源与集成例外见 [源码清单](../../../../scripts/frontend-source.json)。工程规则在 `docs/engineering/frontend`，视觉/Token 选择与设计适配在 [设计入口](../../../design/README.md)；参考仓库不是第二份项目需求/规范。版本以 [package.json](../../../../frontend/package.json) 和 lockfile 为准。

## 技术选型

| 职责 | 当前实现 |
|---|---|
| 应用 | React 18、TypeScript 5、Vite 6；pnpm；Node ≥20.19，CI/Docker Node 22 |
| Router | React Router 6，`app/router/routes.tsx` 同步导入页面，createBrowserRouter；不宣称路由已经懒加载 |
| Provider | AppProviders → I18nextProvider / QueryClientProvider；ThemeInitializer、LocaleInitializer、AnalyticsProvider；启动时校验已有认证会话 |
| 状态与请求 | TanStack Query 5、Zustand、Axios；共享 client，认证 gateway 适配本项目 code=0 信封 |
| 样式与基础 UI | Tailwind 4 + CSS Variables，shadcn/radix-ui；cva 与 cn（clsx + tailwind-merge）；项目 Token 集中定义于 global.css |
| 主题与文案 | Signal Teal 的 light/dark；i18next/react-i18next 的 en/zh 内置资源 |
| 图标与动画 | Lucide/shared icons；GSAP page motion，尊重 reduced motion |
| 日历与分享 | React DayPicker + date-fns；html-to-image 按分享操作加载 |
| 测试 | Vitest、Testing Library、jsdom；shared/testing/setupTests.ts |
| 可选扩展 | shared/analytics、shared/translation、shared/identity；未配置不代表后端具有相应能力 |

## 当前目录与职责

```text
src/
  main.tsx
  app/                  # App、providers、router、error
  pages/                # home、theme、components/componentCatalog.ts、login
  widgets/              # app-header、app-shell
  features/             # auth（本项目 gateway）、share
  shared/               # api/config/theme/i18n/icons/styles/testing/ui/utils
                        # analytics/identity/translation/motion
```

`entities` 只在真实业务需要时新增，不生成空的业务层。公共复用先查 [组件清单](../components/component-inventory.md) 和源码导出。AppHeader 拥有全局导航、设置和账户菜单，AppShell 装配页脚和认证弹窗；shared UI 不读取业务账户或路由。

## 依赖方向

`app → pages → widgets → features → entities（按需）→ shared`，允许上层调用更低层；同层 slice 通过明确组合而非循环 import。Router 由 app 组装，shared 不反向依赖 feature，跨服务不 import Python 源码。

API 事实、错误和授权由 backend 决定；客户端泛型不是运行时校验。AuthUser 是 UI model，不照搬 ORM；后端没有 admin 字段时不从用户名推断权限。具体 [认证与跨端契约](../../../contracts/README.md) 不在本页复制字段。

## 模板与业务边界

通用设计变量、公共控件和现有模板能力示例在 [设计资产](../../../design/README.md#资产登记) 登记；示例不是使用方业务需求，也不证明应用与设计已验收。

基础/主题/组件展示页、通用账号 UI 和分享能力属于模板。具体实体、业务导航、报告与 Agent workflow 进入使用方需求，不通过同步模板自动新增。

当前前后端认证可以联调；AI Runtime 仍单独提供确定性工作流，不把三端启动等同于真实 AI 产品交付。部署约束见 [全栈架构](../../../architecture/README.md)，命令见 [frontend README](../../../../frontend/README.md)。

## 路由与宿主

各页面按真实实现组合 AppShell，后者装配 AppHeader、页脚策略与认证浮层；app 只装配 Provider/Router，不自动为每个路由包第二层壳。`/login` 重定向到首页，未认证时打开 LoginModal；不把它描述为独立登录页面。

AppHeader 的桌面高度来自自身 `h-[60px]` / `min-h-[60px]`，窄屏按源码自适应；不能用未消费的 `--header-height` 推导当前尺寸。内容容器由各页维护，没有统一 `.page-container` 工具类。导航、账户和浮层行为核对 widget/feature 的实际公开 API，系统/浏览器 chrome 不属于页面。
