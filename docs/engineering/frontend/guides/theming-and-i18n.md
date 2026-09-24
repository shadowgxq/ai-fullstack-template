# 换肤与 i18n（theming & i18n）

默认启用 Signal Teal / Neutral 两种配色，每种都有 light / dark。尺寸、字体和间距共用，不为主题建立不同组件。

## 样式事实源

`src/shared/styles/global.css` 集中维护 Tailwind CSS 4 入口、固定 token、语义色、四组主题覆盖、`@theme inline` 映射与 base reset，不另建第二套 token 文件。

- 原始语义变量例如 `--foreground`、`--primary`；Tailwind 对应 `text-foreground`、`bg-primary`。CSS Modules 也引用这些变量。
- 尺寸使用 `--space-*`、`--radius-*`、`--control-*`，排版使用 `--font-size-*` / `--line-height-*`，阴影使用 `--elevation-*`。具体值以 CSS 为准，文档不复制色板和尺寸表。
- reset 必须位于 `@layer base`，避免未分层样式覆盖 Tailwind utilities。
- 条件类使用 `shared/utils/cn`；shadcn CLI 的别名与样式入口由 `frontend/components.json` 配置。不要生成另一套 `components/ui` 或 `lib/utils`。
- 字体保留标准模板的 sans / mono 角色与系统 fallback；`frontend/index.html` 显式加载 Google Fonts 的 Inter、Noto Sans SC、IBM Plex Mono，可能访问 `fonts.googleapis.com` / `fonts.gstatic.com`。不将字体资源误报为业务或埋点请求；离线部署需另行批准自托管方案，不在同步时替换字体。动画尊重 `prefers-reduced-motion`。

## 主题接线

| 环节 | 入口及约定 |
|---|---|
| 状态 | `shared/theme/theme-store.ts`：`mode` 与 `preset`；Zustand persist key 为 `ui-theme` |
| 默认值 | mode 首次读取系统偏好，preset 为 `signal`；兼容旧的仅 mode 存档，非法值回退 |
| 生效 | `ThemeInitializer` 写入 `<html data-theme data-theme-preset>` |
| 调用 | `useTheme()` 提供 mode、preset、setMode、setPreset、toggle |
| 首帧 | `index.html` 在 React 加载前设置相同属性；存储不可读或损坏时仍可启动 |

新增语义 token 时补齐需要变化的四种主题值和 Tailwind 映射；固定几何只定义一次。业务组件不得按主题分支硬编码颜色。

## 国际化接线

资源集中在 `shared/i18n/locales/{en,zh}.json`。`instance.ts` 初始化 i18next；`locale-store.ts` 以 `ui-locale` 保存偏好，`setLocale` 同步实例。`AppProviders` 装配 Provider，`LocaleInitializer` 同步文档语言、标题和描述。

React 文案使用 `useTranslation().t()`，切换语言使用 `useLocale()`；组件名、技术标识符以及调用方提供的内容不强制翻译。新增文案补齐所有语言同名 key，不再维护第二份映射。

新增语言时同步资源、`SUPPORTED_LOCALES`、locale 边界校验、AppHeader/SettingsMenu 语言选项和 `LocaleInitializer` 的 HTML lang 映射，并补测试。

## 移除或替换

只能在明确的项目基线变更中执行：先清点 AppShell、主题页、组件示例及错误页的消费者，再处理 store、Provider、首帧脚本、资源、依赖和测试。仅删除演示页面不能顺带删除公共组件或主题基座。对应规则和 README 同步更新，不另留一套旧接线说明。

当前默认语言为 `en`；预设选择在 ThemePage，明暗/语言在 SettingsMenu。内置 i18n 不调用远端翻译；shared/translation 是独立可选数据翻译 adapter。global.css 的 `--layout-max-width` 为 1336px，AppHeader 实际高度由自身 60px 类控制；不要将未使用 token 的数值误写成所有布局的尺寸。
