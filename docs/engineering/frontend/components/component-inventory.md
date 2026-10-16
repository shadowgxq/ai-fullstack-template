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
| Skeleton | `shared/ui/skeleton.tsx` | shared 基础占位形状；实际内容布局由消费者组合 |
| Calendar | `shared/ui/calendar.tsx` | 现有 DayPicker 包装；月份、选中、禁用与 locale 由调用方提供 |
| QueryComposer | `shared/ui/QueryComposer/index.ts` | 公共查询组合；调用方提供候选、自由输入展示、异步查询与提交动作，继续复用现有代码 |
| ShareDialog | `features/share/index.ts` | feature 公共出口；分享/复制/图片导出，内容与 poster 由使用方提供 |
| AuthField、AuthForm、LoginModal、ChangePasswordForm、ChangePasswordModal | `features/auth/index.ts` | feature 公共出口；认证语义保留在 auth，不升级为 shared 通用表单 |
| GoogleLoginButton | `features/auth/ui/GoogleLoginButton/` | auth 内部组件，不绕过 feature 出口跨模块导入 |
| AppHeader | `widgets/app-header/index.ts` | widget 公共出口；导航、设置与账户；SettingsMenu / AccountMenu 保留内部 |
| AppShell / AppFooter | `widgets/app-shell/index.ts` | widget 公共出口；壳层、主内容跳转、页脚策略、弹窗，不创建第二套 Provider |
| 组件目录 / 详情 | `pages/components/ComponentsPage.tsx`、`ComponentDetailPage.tsx`、`componentCatalog.ts` | 页面组合与演示，不构成业务或全栈验收证据 |

primitive 按文件导入，自建组合组件用窄 `index.ts`；`shared/ui/index.ts` 只保留空出口注释，不是总桶。

feature/widget 的“公共出口”仅表示模块可见性，不表示公共设计系统归属；当前源码位置也不替代 [公共层准入](components.md#公共层准入) 的判断。

认证支持用户名密码注册/登录、会话重验和退出；邮箱验证码、Google、找回/修改密码仅保留可选演示实现，生产入口关闭。权限由服务器核验；mock、隐藏按钮与 UI model 不能替代授权。字段契约见 [跨端契约](../../../contracts/README.md)。

## 归属与复用边界

以下记录当前设计维护单元与真实实现。代码目录、组件目录页的“基础 / 高级”分类和展示板位置都不替代准入判断；设计主组件不与 React 组件一一对应。

| 对象 | 准入依据或未明确边界 | 当前维护方式 |
|---|---|---|
| Design Tokens | 项目 Token 定义与设计同步见 [Token 政策](../../../design/tokens.md#设计与代码同步) | core.lib.pen 的公共变量与 Foundations |
| Button | 操作呈现、变体、尺寸、禁用与 loading；不判断业务成功 | 公共主组件与实例状态 |
| Input、Label、Textarea | 原生字段、关联、readonly / disabled / invalid；不承担领域校验 | 公共控件；Label + 控件 + helper 为普通用法示例，没有公共 Field API |
| Switch | checked、禁用与键盘协议，不固定开关业务含义 | 公共主组件与状态 |
| Select | 单选、受控值、键盘、触发框和选项面板；选项由调用方提供 | 公共交互组件，含完整展开态；当前代码不提供搜索或多选 |
| Tabs、Dialog | 内容切换或浮层焦点/关闭契约；选项、内容与提交流程归消费者 | 公共交互组件与必要示例，不按原子化程度拆分 |
| DropdownMenu、Popover、Tooltip | 菜单或浮层的触发、焦点、关闭与状态；操作及内容由调用方提供 | 公共壳层与中性示例，不固定筛选、分享或导出流程 |
| Skeleton | 无业务的占位形状；内容尺寸与布局归使用方 | 基础主组件在 core，头像/文字/内容组合为普通用法示例 |
| Calendar | 模板共用日期选择；月份、选中、禁用和 locale 由调用方配置 | 保留当前 DayPicker 包装；公共库未登记对应设计主稿 |
| QueryComposer | 模板共用输入与候选交互；三种模式及事件沿用真实 API | core.lib.pen 的主组件与必要状态，继续复用当前 shared 实现 |
| AuthField、AuthForm、LoginModal | 规则、状态与运行时仍由 features/auth 拥有 | 公共库展示认证模式，组合公共字段和浮层；不新增 shared 通用表单 API |
| ShareDialog | 模板共用分享预览、动作菜单与恢复表达；副作用仍由 share feature 拥有 | core.lib.pen 的主组件与必要状态 |
| AppHeader / AppShell | 导航与壳层装配仍由 widget 拥有 | 保留现有源码入口；公共库未登记对应设计主稿 |
| Card、ListItem、Feedback、目录页 | 没有独立公共契约；内容、数据状态、动作和页面布局由消费者拥有 | 就近用于实际页面或功能，不另建一套泛化主组件目录 |

目录页仍列出 `componentCatalog.ts` 的 15 个入口。“13 个基础 + 2 个高级”是展示分类，不是 13 个公共设计组件的批准记录。Calendar / QueryComposer 的运行时契约以现有源码为准。

设计稿中的通用 Button/link、underline Tabs 及淡底徽标、导航小字使用 `foreground`，按 [颜色配对](../../../design/tokens.md#公共颜色契约) 满足当前浅色背景的文字对比要求；通用 link 文字保留下划线以识别操作；认证卡片与浮层底部的文字按钮单独使用 `primary` / `primary-hover`，与普通正文区分。React 的 Button/link、underline Tabs 和部分目录/详情文字仍使用 `text-primary`，link 下划线仅在 hover 显示；这项设计目标尚未同步到运行时代码，不能将 Pen 渲染检查视为代码已通过对比度验收。

## Pencil 定位与映射

资产见 [设计登记](../../../design/README.md#资产登记)。模板设计集中在公共库，业务项目需要时通过正式导入复用；表中 ID 是定位线索，使用前回读文档、主组件、命名空间、主题和覆盖。

| 公共库定位 | 映射或组合边界 |
|---|---|
| `MKpT9` Foundations；`KNJdR` Semantic colors | Foundations 保留 Light / Dark 并排概览；Semantic colors 单份完整公共颜色配对，通过 mode 轴切换主题 |
| `lhFZv` Typography and spacing | 六种文字角色、表单标签、间距、圆角、布局与焦点参数；行高按正式字号/行高投影 |
| `et1HX` Button；`HVHuZ` Input；`zhytp` Label | 变体、状态、尺寸与字段用法；用法容器不是公共主组件 |
| `C0zvOR` Select；`U3VfEB` Tabs；`WUSkr` Switch | 选择与切换契约及必要状态 |
| `tv1M5` Textarea；`KJiwo` Dialog；`zIN7D` DropdownMenu | 输入状态、浮层关系与菜单协议 |
| `RQqGP` Popover；`m8XoV8` Tooltip；`S87yt` Skeleton | 通用容器、提示和基础占位用法 |
| `bzlJA` Authentication modes；主组件 `umFLL` / `QXQie` | 可选验证码、多方式登录及邮箱注册；字段组合 Label / Input，浮层复用 Dialog，不改变默认能力开关 |
| Button：`j8DiT` / `EthvI` / `xWh1X` / `YIss5` / `y6hYPZ` / `hrEJg` | default / outline / secondary / ghost / destructive / link；同一 Button API 的变体 |
| Input / Select / Textarea：`mTBzU` / `MCyOS` / `v1JdnQ` | 控件本体；标签和辅助说明由使用方或示例组合 |
| Select 展开态：`wl5iK` | Trigger + Content + Item 的通用单选组合，含选中指示 |
| Tabs：`m1mgV8` / `O51Bi` | segmented / underline |
| Switch：`FdzMi` / `BHVZs` / `I8Ezw` | 同一 Switch 的 on / off / disabled 状态 |
| Dialog：`ocBvt` | Dialog 及 Header/Body/Footer 的基础组合；内容插槽允许按消费者替换 |
| Label：`QS5ir` | 独立标签样式；运行时关联与 disabled 语义由 Label primitive 及字段使用方承担 |
| DropdownMenu：`AwJuH` | 打开态、选中、禁用、分隔与危险项；子菜单与键盘协议以源码为准 |
| Popover：`YgyA1` / `bPBFx`；Tooltip：`U6Q5Go` | default / compact 浮层与简短提示；内容插槽不预设业务语义 |
| Skeleton：`Q4c4tU` | 基础占位形状；完整内容排布不导出为公共组件 |

分享与查询组合在 `core.lib.pen` 中维护，设计可见性不改变 TypeScript 模块出口。

| 公共库定位 | 工程拥有者与范围 |
|---|---|
| `PsC2d` ShareDialog；主组件 `HrXnd` | features/share；分享预览、图片生成、平台菜单与恢复状态，poster 归调用方 |
| `lBtrf` QueryComposer；主组件 `w6TU7` | shared/ui/QueryComposer；候选、自由输入、异步加载、无结果、失败重试、多行与禁用 |

当前公共库未提供独立的默认密码登录、认证字段、Calendar、AppHeader / AppShell 和目录/详情页面主稿；对应代码与真实接口继续保留。

设计示例用于表达职责与复用，不是现有页面的逐像素基线；页面主稿和桌面宽度检查按 [布局规范](../../../design/ui-spec.md#布局与宿主)。当前不提供手机稿；未来若新增，仍按实际 Web 宿主、组件契约和响应式实现适配。完整 API 与交互协议查源码，展示状态不等于运行时验证。

主题/图标/翻译/analytics/identity 是 shared 能力，不计作 UI 组件。翻译和 analytics 的远端接入需明确配置；保留 SDK 不代表默认发送请求。
