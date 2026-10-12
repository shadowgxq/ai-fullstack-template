# Token 使用政策

[global.css](../../frontend/src/shared/styles/global.css) 是数值、别名依赖、Light / Dark 两种主题与样式映射的唯一人工维护源。本页决定选择范围与用途，不维护第二份值表。视觉关系见 [UI 规范](ui-spec.md)，运行接线见 [主题指南](../engineering/frontend/guides/theming-and-i18n.md)。

## 选择范围

| 范围 | 按需读取与使用 |
|---|---|
| 页面默认选择 | 本任务相关的背景/文字/边界/反馈、文字角色、布局语义与常用间距 |
| 组件内部契约 | 几何、状态、焦点、命中区域和控件专用参数；修改或映射该控件时读取 |
| 基础与工具映射 | 字体尺度、别名、Tailwind 与设计投影；主题/组件/同步任务读取 |

这些是读取和使用范围，不是三份数值源。公共/业务归属按语义与依赖判断；只投影当前消费者需要的变量，不搬运全量声明或为目录齐全新增角色。

组件归属遵循 [公共层准入](../engineering/frontend/components/components.md#公共层准入)。业务组合使用公共 Token 不使其成为公共组件；组合移入消费稿后仍引用导入的公共变量，不复制色板或为布局重新造 Token。仅服务业务的设计参数留在消费稿；已有 CSS 声明不因设计节点调整自动删除或搬迁。

## 页面默认选择

以下名称省略 CSS 的 `--` 前缀。可用声明和 Tailwind 工具类以源码为准，同值不等于同语义。

| 用途 | 默认入口 | 选择依据 |
|---|---|---|
| 画布与正文 | `background`、`foreground` | 页面整体 |
| 内容表面 | `card`、`card-foreground`、`muted-foreground` | 卡片和次要说明；浮层用其专属角色 |
| 关键操作 | Button 的 `variant` / `size` | 映射时读取 `primary` / `primary-foreground`，调用方不自行拼颜色和高度 |
| 边界与焦点 | `border-subtle`、`border`、`border-strong`、`ring` | 分隔、容器、控件和焦点用途分别核对 |
| 操作反馈 | `success`、`warning`、`destructive` 与必要配对 | 状态语义独立，不用一个颜色代替全部状态 |
| 页面与区块 | `layout-max-width`、`layout-gutter`、`section-gap`、`subsection-gap`、`content-gap` | 优先沿用当前页面容器，声明存在不代表每个页面都在消费 |
| 内容容器 | `panel-padding-sm/md/lg`、`radius-card` | 根据现有组合选用，不新增平行 `card-padding` |
| 常用自由间距 | `space-1/2/3/4/5/6/8` | 专门语义优先，不默认展开全部尺度 |

现有文字角色为 `page-title`、`section-title`、`card-title`、`body`、`control`、`caption`，使用相应 `text-<角色>-size` / `text-<角色>-line` 配对；标签用 `label-font-size` / `label-line-height`。sans / mono 由 `font-family-sans` / `font-family-mono` 提供。模板没有独立的 reading / metric 角色；按现有尺度表达所需内容，不臆造正式声明。

`page-bg`、`surface-bg` 等仍可由现有消费者使用，不因为同值增加另一套默认候选。图表、侧栏、浮层、代码和动画集合只在任务需要时展开。

控件文字统一使用 `text-control-size / text-control-line`；正文与控件分别配对，不能仅因为字号相同互换行高。Button 的垂直 Padding 和菜单项的垂直 Padding 复用 `space-*`，高度表达为最小高度，长标签可换行撑高；纯图标按钮保留方形尺寸。QueryComposer 保留已有的大输入区，仅增加最小高度和候选面板最大高度两个内部参数，其余复用字体、间距、圆角、焦点与禁用角色。

Tailwind 任意值对 CSS 变量的类型推断不保证匹配用途：字号用 `text-[length:var(--…)]`，边框宽度用 `border-[length:var(--…)]`，焦点宽度用 `ring-[length:var(--…)]` / `ring-offset-[length:var(--…)]`。不能用仅写 `--tw-ring-width` 的自定义属性替代实际 ring 工具类；样式编译与 Token 引用均需核对。

## 公共颜色契约

Signal Teal 的 Light / Dark 共用以下语义；三块色样只适合作为主题缩略图，不构成完整颜色规范。

| 组别 | 必要角色与配对 | 使用约束 |
|---|---|---|
| 表面与文字 | `background / foreground`、`card / card-foreground`、`popover / popover-foreground`、`muted / muted-foreground` | 页面、内容容器、浮层和辅助区域各自配对；关键内容用 foreground |
| 操作 | `primary / primary-foreground`、`primary-hover`、`primary-active`、`primary-subtle`、`primary-subtle-hover`、`secondary / secondary-foreground`、`accent / accent-foreground` | 主操作、次操作和交互阶段通过真实组件变体选择；淡主色底配 primary，accent 按真实消费者使用 |
| 边界与焦点 | `border-subtle`、`border`、`border-strong`、`input`、`ring`、`control-invalid-border` | 装饰分隔、容器边界、输入边界、焦点和校验分别表达，不以颜色相近互换 |
| 状态反馈 | `success`、`warning`、`destructive` 与各自 `*-subtle`；实心成功/警告使用对应 `*-foreground` | 淡底反馈使用状态色文字；状态同时有说明或图标，错误不能只改红色 |
| 交互表面与遮罩 | `surface-hover`、`surface-selected`、`overlay`；顶栏用 `header-bg / header-border` | 区分悬停、选中、阻断层和壳层；遮罩透明度来自正式 CSS |

先确定用途，再确定配对与状态，最后选择主题值。普通文字及必要反馈按 UI 状态的对比度要求核验实际背景；不能用主色充当成功色，也不能把淡底与实心底的前景混用。当前 Light 的 `primary` 在 `background`、`primary-subtle`、`primary-subtle-hover` 上约为 4.32、4.14、3.90，不满足普通小字的 4.5 要求；这些背景上的小字采用 `foreground`，主色仍可表达满足图形对比要求的图标、选中指示及大字。颜色、间距、字体和组件参数共用一份事实源，不为 Light / Dark 维护两套命名。

图表、侧栏、代码和特定业务状态不进入默认选择面。它们仍可按真实消费者使用源码已有 Token；缺少业务语义时在所属模块讨论，不把所有业务类别预建成公共颜色。

## 组件与新增准入

`button-*`、`input-*`、`query-composer-*`、`dropdown-item-*`、`switch-*`、`tabs-*`、`control-*`、`focus-*` 是内部契约。调用方先用现有变体、尺寸和状态 API；`className` 可透传不等于允许单页改共享缺省值。

新增次序：已有语义 → 已有组件属性/组合 → 符合样式规则的局部结构值 → 确有独立语义后新增 Token。品牌色与核心几何不散落成局部常量，每个值也不必机械增加三层别名。

新增或删除正式 Token 需有源码修改范围，核对独立主题/演进需要、别名依赖及真实消费者，补齐需要变化的 Light / Dark。不能仅凭同值、少见或声明数量判定冗余；设计任务缺少语义时记录最小候选和影响，不反向要求源码接受。

### 公共尺度与组件别名

间距的数值在 `space-*` 集中维护，页面与组件的 Padding / Gap 契约引用对应尺度；同一尺寸不再分别填写原始值。圆角共用 `radius-control`、`radius-surface`、`radius-pill`，`radius-card/panel/dialog` 引用 `radius-surface`。CSS 消费者继续使用与职责匹配的语义别名，调整公共尺度可同步影响这些消费者。

组件专用的宽高、命中区域和内容上限不与同值间距合并。默认 Button 的水平 Padding、组件目录卡片的垂直 Padding 等既有差异保留在各自契约中；确实需要独立演进的参数不为减少数量强制归一。

## 设计投影

Light / Dark 使用同名语义的主题值，共用未变化的结构和几何，不为两主题维护平行 Token 命名或组件。画板展示数量与主题验证分别管理，见 [深浅主题的设计表达](design-handoff.md#深浅主题的设计表达)；减少展示副本不表示可以缺失另一主题的有效值或渲染检查。

同步方向为正式 CSS → 任务所需子集 → 类型/主题/单位/依赖/归属核对 → 设计变量和真实绑定 → 消费者回读。Pencil 变量是设计投影，不是平行人工色板；正式变化后同步对应表达。模板没有独立 Token 导出器，不调用不存在的脚本或过滤参数。

CSS `mode=light/dark` 对应设计库的同名轴；固定几何共用，不为 viewport 构造源码中不存在的响应式值。宽度适配通过实际布局和允许的实例覆盖表达。

CSS 别名尽量保持同类型；需要转换颜色格式、字体映射为设计可用名称、px 行高转成 `lineHeight` 比例时，记录投影与舍入。`*-leading` 是由正式行高/字号计算的设计投影，不是新增 CSS Token。阴影、easing 和不能绑定的属性记录解析来源与限制，metadata 不能冒充变量联动。

公共库提供 74 个设计变量：37 个颜色角色、19 个字体投影、11 个间距、7 个几何与状态参数。间距只投影已使用的公共尺度；CSS 中其他有消费者的尺度继续保留。组件 Padding / Gap 直接绑定公共间距，卡片、面板和对话框直接绑定 `radius-surface`，不把 CSS 的每个组件别名重复投影到变量面板。仅 Calendar 使用的 `calendar-caption-leading` 在业务稿局部投影，仍由正式 `line-height-sm ÷ font-size-sm` 计算。

字号共用尺度，角色保留各自的行高配对。示例内容槽、实例覆盖与业务组合中的文字也使用以下绑定：

| 文字用途 | 设计字号绑定 | 设计行高绑定 |
|---|---|---|
| 页面 / 区块标题 | `text-page-title-size` / `text-section-title-size` | `page-title-leading` / `section-title-leading` |
| 卡片标题 | `font-size-lg` | `card-title-leading` |
| 正文 / 控件 / 标签 | `font-size-md` | `body-leading` / `control-leading` / `label-leading` |
| 辅助说明 | `font-size-xs` | `caption-leading` |
| Calendar 月份标题（业务稿） | 导入的 `font-size-sm` | 局部 `calendar-caption-leading` |
| DialogTitle / QueryComposer 输入 | `font-size-lg` | `large-text-leading` |

`large-text-leading` 共用正式 `line-height-lg ÷ font-size-lg` 的投影；辅助说明仍配对自己的字号与行高，不能只因比例相同互换角色。字体集合还包括 sans / mono 和 regular / medium / semibold 字重；其他源码尺度按真实需要投影，不预建全集。

几何支持绑定时使用公共变量；宽高属性无法保留变量时使用正式 CSS 的解析值，并在对应组件 context 或 token-map 记录来源，不为无法绑定的宽高保留闲置设计变量。日历日期格的实际宽高由可用宽度与七列布局决定，`control-height-md` 是最小命中尺寸。

消费稿不复制导入变量。变量名、值、主题或库变化后检查对应主组件、允许覆盖和直接消费者。74 是 Pencil 的公共选择面，不是 CSS 声明总数；业务局部投影不成为第二份数值源，源码语义契约与基础尺度仍由真实消费者决定。
