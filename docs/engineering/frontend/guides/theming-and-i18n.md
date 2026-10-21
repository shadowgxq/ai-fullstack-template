# 换肤与 i18n（theming & i18n）

本页维护 theme / i18n、样式和字体的运行接线。Signal Teal 只提供 light / dark 两套配色，几何共用。视觉见 [UI 规范](../../../../frontend/design/ui-spec.md)，Token 选择与设计同步见 [政策](../../../../frontend/design/tokens.md)，设计适配见 [交付约定](../../../../frontend/design/design-handoff.md)。

## 样式事实源

`src/shared/styles/global.css` 集中维护 Tailwind CSS 4 入口、Light / Dark 主题值、`@theme inline` 与 base reset；Token 的选择与设计同步见上述政策。

- 原始语义变量例如 `--foreground`、`--primary`；Tailwind 对应 `text-foreground`、`bg-primary`。CSS Modules 也引用这些变量。
- reset 必须位于 `@layer base`，避免未分层样式覆盖 Tailwind utilities。
- 条件类使用 `shared/utils/cn`；shadcn CLI 的别名与样式入口由 `frontend/components.json` 配置。不要生成另一套 `components/ui` 或 `lib/utils`。
- 字体保留 sans / mono 与系统 fallback；`frontend/index.html` 加载 Google Fonts 的 Inter、Noto Sans SC、IBM Plex Mono，可能访问 `fonts.googleapis.com` / `fonts.gstatic.com`。字体资源与业务/埋点请求分别说明，离线部署按独立配置变更处理。减少动态效果见 [UI 状态](../standards/accessibility-and-ui-states.md)。

## 主题接线

| 环节 | 入口及约定 |
|---|---|
| 状态 | `shared/theme/theme-store.ts`：`mode`；Zustand persist key 为 `ui-theme` |
| 默认值 | 首次读取系统明暗偏好；旧存档的 mode 沿用，旧 preset 忽略，非法 mode 回退 |
| 生效 | `ThemeInitializer` 写入 `<html data-theme>` |
| 调用 | `useTheme()` 提供 mode、setMode、toggle |
| 首帧 | `index.html` 在 React 加载前设置相同属性；存储不可读或损坏时仍可启动 |

Token 变更按政策补齐主题与直接消费者；业务组件不按 mode 分支硬编码颜色。

## 国际化接线

资源集中在 `shared/i18n/locales/{en,zh}.json`。`instance.ts` 初始化 i18next；`locale-store.ts` 以 `ui-locale` 保存偏好，`setLocale` 同步实例。`AppProviders` 装配 Provider，`LocaleInitializer` 同步文档语言、标题和描述。

React 文案使用 `useTranslation().t()`，切换语言使用 `useLocale()`；组件名、技术标识符以及调用方提供的内容不强制翻译。新增文案补齐所有语言同名 key，不再维护第二份映射。

新增语言时同步资源、`SUPPORTED_LOCALES`、locale 边界校验、AppHeader/SettingsMenu 语言选项和 `LocaleInitializer` 的 HTML lang 映射，并补测试。

## 移除或替换

只能在明确的项目基线变更中执行：先清点 AppShell、主题页、组件示例及错误页的消费者，再处理 store、Provider、首帧脚本、资源、依赖和测试。仅删除演示页面不能顺带删除公共组件或主题基座。对应规则和 README 同步更新，不另留一套旧接线说明。

当前默认语言为 `en`；ThemePage 与 SettingsMenu 均可切换明暗，语言在 SettingsMenu。内置 i18n 不调用远端翻译；shared/translation 是独立可选 adapter。布局声明不代表所有组件都在消费，顶栏的实际尺寸来源见 [路由与宿主](../architecture/technology-options.md#路由与宿主)。
