# UI Component Inventory

清单记录当前职责与源码入口，不复制 props。相对路径均在 `frontend/src/`；组件使用先查 TypeScript 导出，再按 [复用规范](components.md) 选择。

| 组件族 | 真实入口 | 边界 |
|---|---|---|
| Button | `shared/ui/button.tsx` | variant/size/loading/asChild；调用方负责提交幂等 |
| Input、Label、Textarea | `shared/ui/{input,label,textarea}.tsx` | 原生表单语义与状态样式 |
| Select、Switch、Tabs | `shared/ui/{select,switch,tabs}.tsx` | 可控选择和键盘交互 |
| Dialog | `shared/ui/dialog.tsx` | Portal、遮罩、焦点、尺寸、Header/Body/Footer |
| DropdownMenu、Popover、Tooltip | `shared/ui/{dropdown-menu,popover,tooltip}.tsx` | 复用 primitive 的浮层与焦点协议 |
| Skeleton、Calendar | `shared/ui/{skeleton,calendar}.tsx` | 占位；DayPicker 日期选择 |
| QueryComposer | `shared/ui/QueryComposer/index.ts` | 候选、输入、取消/迟到结果；API adapter 由消费者注入 |
| ShareDialog | `features/share/index.ts` | 分享/复制/图片导出；内容与 poster 由使用方提供 |
| AuthForm、LoginModal | `features/auth/index.ts`；内部 `ui/AuthForm`、`ui/LoginModal` | 标准账号 UI，gateway 与能力开关按真实 backend 接入 |
| AuthField、GoogleLoginButton、ChangePasswordModal | `features/auth/ui/` | feature 内部组合；未支持的生产能力无入口，不直接作为 shared 通用表单 |
| AppHeader | `widgets/app-header/index.ts` | 主导航、SettingsMenu、AccountMenu；账户身份原样展示 |
| AppShell / AppFooter | `widgets/app-shell/index.ts`、`widgets/app-shell/AppFooter.tsx` | 壳层、跳转主内容、页脚策略、弹窗；不创建第二套 Provider |
| 组件目录 / 详情 | `pages/components/ComponentsPage.tsx`、`ComponentDetailPage.tsx`、`componentCatalog.ts` | 标准基础交互展示，非业务或全栈验收证据 |

primitive 按文件导入，自建组合组件用窄 `index.ts`；`shared/ui/index.ts` 只保留空出口注释，**不是总桶**。不要引用已删除的旧 DemoSection/ControlDemos/OverlayDemos/AdvancedDemos 目录。

认证支持用户名密码注册/登录、会话重验、退出；邮箱验证码、Google、找回/修改密码仅保留可选演示实现，生产入口关闭。权限由服务器核验；mock、隐藏按钮与 UI model 不能替代授权。字段契约见 [跨端契约](../../../contracts/README.md)。

主题/图标/翻译/analytics/identity 是 shared 能力，不计作 UI 组件。翻译和 analytics 的远端接入需明确配置；保留 SDK 不代表默认发送请求。
