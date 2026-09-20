# UI Component Inventory

当前实现清单；治理判断见 [Components](components.md)。统计按组件族，不逐项统计 Radix 子组件。路由页面、Provider、错误入口、hook 和工具函数不计入 UI 组件。

| Layer | Count | 范围 |
|---|---:|---|
| `shared/ui` | 14 | 13 组 primitive + QueryComposer |
| `features/*/ui` | 1 | ShareDialog |
| `widgets/*/ui` | 1 | AppShell |
| `pages/*/ui` | 4 | 组件库私有演示区块，不是公共 API |
| `entities/*/ui` | 0 | 不预置业务实体 |

## 公共组件

以下组件均已实现。路径相对 `frontend/src/`；入口符号及完整 props 以 TypeScript 导出为准，不在文档复制类型定义。

| Component | 入口 | 职责与边界 | 使用场景 |
|---|---|---|---|
| Button | `shared/ui/button` | 变体、尺寸、loading、asChild；不负责提交事务 | 首页、主题、浮层、分享 |
| Input / Label / Textarea | `shared/ui/{input,label,textarea}` | 原生表单语义、ref、错误与禁用样式 | 主题预览、组件库 |
| Select | `shared/ui/select` | 选择器交互；选项由调用方提供 | 组件库 |
| Switch | `shared/ui/switch` | 可控开关，不承载业务配置 | 主题、组件库 |
| Tabs | `shared/ui/tabs` | 标签页和键盘导航 | 组件库 |
| Dialog | `shared/ui/dialog` | 焦点管理、标题、关闭、尺寸和 flush 布局 | 组件库、ShareDialog |
| DropdownMenu | `shared/ui/dropdown-menu` | 菜单、单选/复选项 | AppShell 设置、组件库 |
| Popover | `shared/ui/popover` | default / compact 浮层 | 组件库、分享渠道与复制菜单 |
| Tooltip | `shared/ui/tooltip` | 悬停与键盘聚焦提示 | 组件库 |
| Skeleton | `shared/ui/skeleton` | 装饰性占位；调用方提供 loading 状态文案 | 组件库 |
| Calendar | `shared/ui/calendar` | 日历、选择模式与 locale 透传 | 组件库 |
| QueryComposer | `shared/ui/QueryComposer` | 远程候选、自由输入、混合模式；不内置业务搜索接口 | 组件库、本地与异步回归测试 |
| ShareDialog | `features/share` | 预览、渠道/系统分享、复制和图片下载 | 组件库；海报由调用方提供 |

## 组合区块

| Component | 入口 | 边界 |
|---|---|---|
| AppShell | `widgets/app-shell` | 导航、主题与语言设置；不包含账户或权限模块 |
| DemoSection | `pages/components/ui/DemoSection` | 演示区域容器 |
| ControlDemos / OverlayDemos / AdvancedDemos | `pages/components/ui/` 下各自目录 | 本地交互样例，不能视为业务联调实现 |

## 接入约束

- QueryComposer 的 `value`、文案、候选渲染和提交动作由调用方持有；远程适配器接收 `AbortSignal`，需配合取消请求。保持搜索函数引用稳定，避免无意义的重新搜索。
- ShareDialog 的 `content` 与 `poster` 由使用方提供。只传入允许公开的 URL、文字和图片；URL 清理只移除常见凭据参数，不是授权检查或完整隐私过滤器。不得直接分享私有页面状态。
- 剪贴板、原生分享与图片导出受浏览器能力和安全上下文限制；取消不视为失败，捕获失败后保留文字/链接操作。分享弹窗不会自动发送内容，渠道操作由用户触发。
- 现有 `shared/api`、根 `/api/v1` 契约和 Nginx `/api` 代理继续使用，不引入来源模板的 `/v1/account`、统计 SDK 或产品账号流程。具体接口定义只见 [跨端契约](../../../contracts/README.md)。
