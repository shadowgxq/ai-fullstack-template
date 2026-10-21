# Web Token 使用政策

[global.css](../src/shared/styles/global.css) 集中定义 Web 运行时 Token、Light / Dark 主题值与 CSS / Tailwind 映射。本页维护 Web 选择范围与用途，不维护第二份值表。跨端色值所有权和同步边界见 [共享配色政策](../../docs/design/tokens.md)；小程序专属分层见 [小程序 Token](../../miniprogram/design/tokens.md)。视觉关系见 [UI 规范](ui-spec.md)，运行接线见 [主题指南](../../docs/engineering/frontend/guides/theming-and-i18n.md)，设计资产见 [资产登记](README.md#资产登记)。

## 设计与代码同步

设计稿中的变量、组件样式与项目 Token、组件实现保持一致。设计变更同步到受影响的项目 Token 和组件；项目中的共享视觉调整也同步到对应设计表达。

Web 代码中的颜色、字体、间距与公共几何统一引用项目 Token，Web 运行时定义由 `global.css` 集中维护。跨端色值变更遵循共享配色政策；Web 几何不覆盖移动端 `tokens.scss`。

## 选择与使用

以下名称省略 CSS 的 `--` 前缀。先确定语义和背景，再选状态；同值不等于同用途。

| 用途 | 入口与规则 |
|---|---|
| 页面、内容和浮层 | `background / foreground`、`card / card-foreground`、`popover / popover-foreground` |
| 辅助内容 | `muted / muted-foreground`，关键结果和错误不降为辅助文字 |
| 操作 | 先用 Button 的 `variant` / `size`；主操作及其 hover / active 使用 `primary` 系列 |
| 边界与焦点 | `border-subtle`、`border`、`border-strong`、`input`、`ring`、`control-invalid-border` 分别对应分隔、容器、必要边界、输入、焦点和校验 |
| 反馈 | `success`、`warning`、`destructive` 与各自淡底；实心成功/警告使用配对的 `*-foreground` |
| 交互表面 | `surface-hover`、`surface-selected`；顶栏使用 `header-bg / header-border`，阻断遮罩使用 `overlay` |
| 自由间距 | `space-*`；组件内部紧凑，区块间留白更大 |
| 圆角 | 控件用 `radius-control`，卡片/面板/对话框用 `radius-surface`，胶囊用 `radius-pill` |

调用方优先使用组件现有的变体、尺寸和状态 API；品牌色与核心几何不散落成局部常量。

## 字体与单位

sans / mono 使用 `font-family-sans / font-family-mono`，包含系统及中文 fallback。文字角色的字号与行高配对如下。

| 文字角色 | 字号 / 行高 |
|---|---|
| 页面标题 | `text-page-title-size / page-title-leading` |
| 区块标题 | `text-section-title-size / section-title-leading` |
| 卡片标题 | `font-size-lg / card-title-leading` |
| 正文 | `font-size-md / body-leading` |
| 控件 | `font-size-md / control-leading` |
| 标签 | `font-size-md / label-leading` |
| 辅助说明 | `font-size-xs / caption-leading` |
| 浮层标题与查询输入 | `font-size-lg / large-text-leading` |
| Calendar 月份标题 | `font-size-sm / calendar-caption-leading` |

`*-leading` 使用无单位行高比例，与对应字号配对。认证字段、操作、切换和记住我使用 `font-size-lg` 与相应行高，辅助说明和请求反馈使用各自的文字角色。

长度使用 CSS px；字重由 `font-weight-regular / font-weight-medium / font-weight-semibold` 提供。`disabled-opacity-percent` 在 CSS 消费时除以 100，八位十六进制颜色保留 alpha。Tailwind 的字号使用 `text-[length:var(--…)]`，边框与焦点宽度使用 `border-[length:var(--…)]` / `ring-[length:var(--…)]`，避免类型推断生成颜色规则。

## 组件状态与运行适配

- 通用 link 使用 `foreground` 并始终显示下划线；认证卡片/浮层底部的文字按钮使用 `primary / primary-hover`，不显示下划线。
- underline Tabs 的选中文字使用 `foreground`，指示线使用 `primary`；segmented Tabs 使用主色实心选中态。
- Input 的 focus 和 invalid 使用加粗内边界，Textarea 的 focus 使用相同焦点宽度；Select 和 Textarea 保留各自的状态样式。
- QueryComposer 使用实色语义焦点外环；候选面板引用表面圆角、紧凑 inset 和自己的阴影。DropdownMenu 外表面使用 `radius-surface`，菜单项使用 `radius-control`。
- 默认 Button 和菜单项使用最小高度、自然换行；纯图标按钮保留方形尺寸。

`global.css` 集中定义组件几何、候选面板高度上限、触控命中尺寸、动画时长与 easing。

Light / Dark 使用同名语义的主题值，共用未变化的结构和几何，不为两主题维护平行 Token 命名或组件。
