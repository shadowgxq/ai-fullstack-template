# UI Component Inventory

清单记录当前职责、可见性与设计定位，不复制 props。源码路径均相对 `frontend/src/`；API 以真实 export/类型为准，选择和拆分见 [组件治理](components.md)。

## 工程入口与可见性

| 组件族 | 真实入口 | 可见性与边界 |
|---|---|---|
| Button | `shared/ui/button.tsx` | 公共 primitive；variant/size/loading/asChild，调用方负责提交幂等 |
| Input、Label、Textarea | `shared/ui/{input,label,textarea}.tsx` | 公共 primitive；原生表单语义与状态样式 |
| Select、Switch、Tabs | `shared/ui/{select,switch,tabs}.tsx` | 公共 primitive；可控选择和键盘交互 |
| Dialog | `shared/ui/dialog.tsx` | 公共 primitive；Portal、遮罩、焦点、尺寸、Header/Body/Footer |
| DropdownMenu、Popover、Tooltip | `shared/ui/{dropdown-menu,popover,tooltip}.tsx` | 公共 primitive；浮层与焦点协议 |
| Skeleton、Calendar | `shared/ui/{skeleton,calendar}.tsx` | 公共 primitive；占位与 DayPicker 日期选择 |
| QueryComposer | `shared/ui/QueryComposer/index.ts` | 公共组合；候选、输入、取消/迟到结果，API adapter 由消费者注入 |
| ShareDialog | `features/share/index.ts` | feature 公共出口；分享/复制/图片导出，内容与 poster 由使用方提供 |
| AuthField、AuthForm、LoginModal、ChangePasswordForm、ChangePasswordModal | `features/auth/index.ts` | feature 公共出口；认证语义保留在 auth，不升级为 shared 通用表单 |
| GoogleLoginButton | `features/auth/ui/GoogleLoginButton/` | auth 内部组件，不绕过 feature 出口跨模块导入 |
| AppHeader | `widgets/app-header/index.ts` | widget 公共出口；导航、设置与账户；SettingsMenu / AccountMenu 保留内部 |
| AppShell / AppFooter | `widgets/app-shell/index.ts` | widget 公共出口；壳层、主内容跳转、页脚策略、弹窗，不创建第二套 Provider |
| 组件目录 / 详情 | `pages/components/ComponentsPage.tsx`、`ComponentDetailPage.tsx`、`componentCatalog.ts` | 页面组合与演示，不构成业务或全栈验收证据 |

primitive 按文件导入，自建组合组件用窄 `index.ts`；`shared/ui/index.ts` 只保留空出口注释，不是总桶。不要引用已删除的旧 DemoSection/ControlDemos/OverlayDemos/AdvancedDemos 目录。

认证支持用户名密码注册/登录、会话重验和退出；邮箱验证码、Google、找回/修改密码仅保留可选演示实现，生产入口关闭。权限由服务器核验；mock、隐藏按钮与 UI model 不能替代授权。字段契约见 [跨端契约](../../../contracts/README.md)。

## Pencil 定位与映射

资产见 [设计登记](../../../design/README.md#资产登记)。公共库通过正式导入连接到消费稿；表中 ID 是定位线索，使用前回读文档、主组件、命名空间、主题和覆盖。

| 公共库定位 | 映射或组合边界 |
|---|---|
| `MKpT9` Foundations；`KNJdR` Semantic colors | 青色 Light / Dark 的概览与完整公共颜色配对；只含 mode 轴，数值源为 global.css |
| `lhFZv` Typography and spacing | 六种文字角色、表单标签、间距、圆角、布局与焦点参数；行高按正式字号/行高投影 |
| `pSii0` Public components；`PgzCl` Interaction states | 公共控件与必要交互状态 |
| `q4pId` / `ywtIg` Extended components | 菜单、浮层、提示、标签、日历与骨架屏的 Light / Dark 展示；Dark 引用相同主组件 |
| `gIYIV` QueryComposer states | hybrid 候选、remote_only 加载/空/失败、多行输入、禁用及 Dark 状态 |
| Button：`j8DiT` / `EthvI` / `xWh1X` / `YIss5` / `y6hYPZ` / `hrEJg` | default / outline / secondary / ghost / destructive / link；同一 Button API 的变体 |
| Field：`sNvUv` / `Y4nas` / `UtJiC` | Label + Input / Select / Textarea + helper/error 的设计组合，不存在独立 shared Field API |
| Tabs：`m1mgV8` / `O51Bi` | segmented / underline |
| Switch：`FdzMi` / `BHVZs` / `I8Ezw` | 同一 Switch 的 on / off / disabled 状态 |
| Dialog：`ocBvt` | Dialog 及 Header/Body/Footer 的基础组合；内容插槽允许按消费者替换 |
| Card / ListItem：`ck9Uf` / `wvEwX` | 内容组合模式；模板没有同名公共 React 组件 |
| Feedback：`qvVYM` / `UWG4y` / `I0NGKB` | loading / empty / error 模式；消费者拥有数据状态和恢复 action |
| Label：`QS5ir` | 独立标签样式；运行时关联与 disabled 语义由 Label primitive 及字段使用方承担 |
| DropdownMenu：`AwJuH` | 打开态、选中、禁用、分隔与危险项；子菜单与键盘协议以源码为准 |
| Popover：`YgyA1` / `bPBFx`；Tooltip：`U6Q5Go` | default / compact 浮层与简短提示；内容插槽不预设业务语义 |
| Skeleton：`rGgIH`；Calendar：`nETr4` | 内容占位模式；日期单选、今天、外月和禁用示例，locale/日期由消费者提供 |
| QueryComposer：`tMJJE` | 公共查询组合；视觉主组件与状态实例复用，候选、提交和恢复回调归消费者 |

消费稿 `examples.pen` 的业务主组件只在本文件复用，引用公共库的控件与变量；“设计私有”不改变对应 feature/widget 的 TypeScript 公共出口。

| 消费稿定位 | 工程拥有者 |
|---|---|
| `E2KNK` Feature compositions | 模板组合目录；默认能力，不展示未启用 provider |
| `t60H5i` AppHeader | widgets/app-header；AppShell 负责挂载与全局策略 |
| `U59RVh` AuthForm；`mVE68` LoginModal | features/auth；字段、模式、记住我和反馈归认证 feature |
| `zy3kc` ShareDialog | features/share；poster 归调用方，操作按真实能力选择 |
| `xDQ6v` / `Y76aaL` Component catalog | 桌面 Light / Dark 页面组合，壳层和内容分开表达 |
| `Kaxc4` Feature states | 认证空输入/提交/失败及分享图片生成状态 |
| `g0kOv` / `J9Wqj` All component examples | 15 个 demo 入口的 Light / Dark 展示；公共实例引用 core，完整 ShareDialog 在 Feature compositions |

消费稿的 All component examples / Light、Dark 两张 1440px 展示板覆盖 `componentCatalog.ts` 的全部 15 个入口；公共实例通过导入连接到 core.lib.pen，ShareDialog 复用本文件的 feature 主组件。

设计示例用于表达职责与复用，不是现有页面的逐像素基线；页面主稿和桌面宽度检查按 [布局规范](../../../design/ui-spec.md#布局与宿主)。当前不提供手机稿；未来若新增，仍按实际 Web 宿主、组件契约和响应式实现适配。完整 API 与交互协议查源码，展示状态不等于运行时验证。

主题/图标/翻译/analytics/identity 是 shared 能力，不计作 UI 组件。翻译和 analytics 的远端接入需明确配置；保留 SDK 不代表默认发送请求。
