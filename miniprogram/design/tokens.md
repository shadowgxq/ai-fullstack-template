# 移动端 Token 架构

采用 **Reference → Semantic → Component** 三层别名，命名使用 `--mp-` 隔离平台运行时。该分层借鉴 [DTCG 2025.10 Format](https://www.designtokens.org/tr/2025.10/format/) 的命名引用与单一来源原则；当前实现为 CSS/SCSS，不宣称完整实现 DTCG JSON 格式，也不把 Community Group 报告称为 W3C Standard。跨端所有权见 [共享配色政策](../../docs/design/tokens.md)，本页维护小程序的生成与消费细节。

## 唯一来源与生成方向

```text
frontend/src/shared/styles/global.css   现有共享品牌/状态色值（Light/Dark）
                  ↓ sync-tokens.mjs（只提取允许的颜色，不提取 Web 尺寸）
miniprogram/src/shared/styles/palette.generated.scss  Reference colors
miniprogram/src/shared/theme/native.generated.ts      原生导航/TabBar 同源映射
miniprogram/src/theme.generated.json                  微信系统主题初始化
miniprogram/src/assets/tabbar/*.png                   两主题普通/选中图标

miniprogram/src/shared/styles/tokens.scss
  Reference dimensions → Semantic aliases → Component aliases
                  ↓
PageShell / Button / Field / Card / Notice / StatePanel
```

色值仍归现有 `global.css`，不增加手写色板或另一个 `tokens.json`。生成器按白名单读取两主题，缺失、重复或不支持的值直接报错，不回退到另一份颜色。生成物提交并由 `tokens:check` 检查漂移；CI 不自动修复漂移。Web 源码不导入小程序生成物，小程序运行时也不引入 Web CSS/Tailwind。

`tokens.scss` 是移动端尺寸与别名事实源。本页维护职责和选择方法，不复制完整值表；源码中的当前值可以通过组件页观察。需要脱离 Web 的独立品牌时先显式迁移所有者，不悄悄停止生成或在局部覆写品牌值。

## 分层与消费

| 层 | 示例 | 拥有者与规则 |
|---|---|---|
| Reference | `mp-ref-color-primary`、`mp-ref-space-4`、`mp-ref-font-3` | 颜色自动生成；尺寸由本端维护。原始值不散落在页面 |
| Semantic | `mp-surface-page`、`mp-text-primary`、`mp-action-primary`、`mp-page-gutter`、`mp-touch-min` | 页面与跨组件角色；同值不意味着同用途，页面优先使用这一层 |
| Component | `mp-button-bg`、`mp-button-min-height`、`mp-input-border`、`mp-card-padding` | 控件内部职责；优先引用 Semantic，组件变体覆盖组件职责而非全局值 |

例如 `mp-ref-color-primary → mp-action-primary → mp-button-bg`。颜色变化不改变移动几何，移动字号/间距变化不影响 Web。版面约束、文字角色、最小触控和表面圆角各有语义，不机械把所有数值都抽成无限 Token。

## 主题、单位与原生映射

两主题共用结构和尺寸，只替换 Reference colors。每个 `PageShell` 具有 `mp-theme-root theme-light/dark`；Reference 与依赖它们的 Semantic/Component 别名在同一主题根重新声明，避免 CSS 自定义属性在父级求值后继承导致局部暗色失效。切换主题同时更新原生 navigationBar/background/TabBar，返回保留的页面时重新同步；非 Tab 页不更新 TabBar。

原生配置中需要实色的字段由生成器输出，不把 `var(...)` 当成 JSON 色值。navigationBar 前景与边框仅接受平台黑/白枚举，不创造第三种值。系统/浅色/深色偏好存储在本端，存储失败可见，不宣称已保存。系统主题初始化与用户覆盖分开。

原生 TabBar 使用本地 PNG 图标，不使用字体字符或远程图片。形状由 [tab-icons.mjs](../scripts/tab-icons.mjs) 维护，`sync-tokens.mjs` 使用 `muted-foreground` / `primary` 生成普通/选中状态；两主题共 12 个资产。选中态同时改变轮廓/填充。生成尺寸是资源像素，不是 TabBar 高度或触控尺寸，显示几何与安全区仍由微信管理。

`app.config.ts` 通过主题键选择启动图标；运行时以 `setTabBarItem` 和 `setTabBarStyle` 同步用户偏好。边框配置保留 Taro 支持的 `white` 默认值，再由运行时切换为对应黑/白值。连续原生外观更新按调用顺序执行，避免旧图标迟到覆盖新主题；个别 API 失败不阻断其余更新。配置显式复制两主题资源，产物检查核对引用和文件，不能仅凭源码路径存在判断包内资源可达。

长度默认逻辑 px、行高无单位、动画时长 ms、透明度 0–1。关闭自动 pxtransform，避免在窄屏缩小可触区域；安全区为运行时 `env()`，不参与品牌色或固定设备 Token。UI 层仅通过组件 Props 调状态，不能用任意局部颜色覆盖全局主题。

## 当前设计候选

“轻原生 C”的色值、字阶、间距、圆角及宿主文字说明集中在 `mobile.lib.pen` 的独立简版视觉规范页；该页不陈列基础控件，主组件来源另置于基础组件页的非展示分组，定位见 [移动设计交接](design-handoff.md)。品牌基础色仍沿用现有来源；新增柔光/Hero/控件角色和候选几何仅在设计资产表达，不自动覆盖本页的正式生成方向或 `tokens.scss`。确认并接入新视觉时，由正式值源同步后再检查生成漂移，不直接将 Pen 变量视为已发布运行时 Token。

## 变更与验证

颜色修改先更新既有源/设计表达，再 `pnpm --dir miniprogram tokens`；移动几何直接改 `tokens.scss` 与相关组件。图标生成物同样提交并检查漂移，不单独手改 PNG 颜色。检查两主题、必要状态、生成漂移和涉及布局；真实触控/键盘/原生主题仍需单独验收。移动设计变量在 `mobile.lib.pen` 维护，实际绑定及检查范围见 [移动设计交接](design-handoff.md)。生成 SCSS 或图标不等于设计同步或设备视觉验收。

## 智能衣柜移动端密度映射

`wardrobe.pen` 的 `wardrobe-mobile-*` 为当前业务设计的小程序移动端几何候选，区分触控范围、场景按钮视觉层、筛选标签视觉层，以及底部导航的高度、图标、标签和图文间距；颜色、字体和基础圆角继续复用公共语义，不另建业务色板或替换公共 PC 组件默认值。实际几何与范围见 [业务移动 UI](wardrobe-ui-spec.md#布局与宿主)，本次解析证据及绑定限制见 [业务设计交付](wardrobe-ui-ux.md#组件与实现边界)。

这些业务设计变量尚未接入小程序运行时。共享色值以 `global.css` 为源，小程序尺寸与别名以 `miniprogram/src/shared/styles/tokens.scss` 为源，生成方向见 [移动 Token](tokens.md)。业务实现时将已接受的角色映射到该值源与实际控件 API，不将设计变量名直接当作已有 CSS 变量，也不将业务尺寸自动应用到公共 PC 模板。
