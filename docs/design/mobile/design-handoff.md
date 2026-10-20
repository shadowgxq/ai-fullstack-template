# 小程序设计交接

适用于通用小程序工程模板的设计评审与后续实现。可编辑来源为 [mobile.lib.pen](../design-system/mobile.lib.pen)；平台与几何见 [移动 UI](ui-spec.md)，Token 来源见 [移动 Token](tokens.md)。设计覆盖不代表运行时代码已实现。

## 维护结构与定位

维护单元为三份规范与五个模板页面；规范在上、页面在下，按编号读取。

| 维护单元 | 根 Frame | 当前内容 |
|---|---|---|
| 01 Foundations | `X1eLW` | Design Tokens、同源 Light / Dark 配对、字阶、间距、圆角及微信宿主说明 |
| 02 UI Components | `k1clDx` | Button、Field、Cell/Search、Card/排版、Feedback、Tabs、Switch 与基础输入示例 |
| 03 Interaction Patterns | `xJVeh` | Dialog、ActionSheet、Disclosure、搜索空态、错误恢复、图片选择和账户局部替换；独立标记的非默认选择/日期参考 |
| 04 首页 | `Olawm` | 模板介绍、能力入口、外观与账户、次级服务诊断 |
| 05 组件展示中心 | `WEVoz` | 搜索、核心优先目录、交互及扩展分类 |
| 06 组件详情 | `R6E697` | 一套通用详情布局，输入框为代表体验区，通过实例及状态切换复用 |
| 07 我的 | `eeywA` | 账户摘要、分组外观设置与应用信息 |
| 08 登录 | `jK9Ug` | 用户名、密码、校验与提交 |

五个页面保留 375 × 812 逻辑 px 取景，每页只有一份可编辑内容，嵌套在内容滚动视口内。内容节点依次为首页 `hRZHY`、目录 `VyiQy`、详情 `mv6de`、我的 `qsBTF`、登录 `iWxjx`；完整内容需读取这些节点，不能将首屏裁切误作内容缺失。

宿主规范 `DoGHU` 位于 Foundations 内，不再作为根画板。搜索无结果、本地图片预览和已登录账户均归入 Interaction Patterns，不另设补充状态板；它们是局部替换，不是完整页面副本。字段错误、pressed、loading、disabled 和通知状态由主组件或同源实例维护，不复制完整表单。

## 模板范围与扩展边界

保留 Signal Teal、Reference → Semantic → Component Token 架构及同源双主题；不追求 Web 组件在小程序中逐项对应。原首页的方向接受记录继续适用，本次整理不新增人工接受或产品验收结论。

- 核心优先：目录默认展示 8 项：Button、Field、Cell、Search、Card/排版、Feedback/StatePanel、Switch、Tabs。交互和扩展通过分类定位，沿用同一列表与详情结构，不建立分类全页副本。分类内容保留在同一内容源的条件区域中，默认不启用；不要将非默认区域当成另一份完整页面。
- 可选参考：`tOQKd` 位于 Interaction Patterns 的独立扩展列，仅保留 Select / Calendar 的成熟设计；当前小程序代码没有对应消费者。新增业务实际需要时，再评估原生或第三方方案、版本、主题与交互，不把静态稿视为已实现组件。
- 非默认组合：QueryComposer 与分享预览不属于当前小程序模板的必要能力，不在移动资产中维护。Web 库及现有 Web 代码不受影响，不删除或改变任何运行时契约。
- 不新增独立组件详情页面；示例中的不同控件通过同一详情壳及组件实例表达。

## 组件定位与运行时映射

公开 API 以 [shared/ui/index.tsx](../../../miniprogram/src/shared/ui/index.tsx) 为准；完整接口以源码为准，不从设计名称臆造 export。

| 设计来源 | 运行时能力或设计边界 |
|---|---|
| Button：`w1qYK` primary、`h8f9wR` secondary、`qj6Cm` danger | Button `variant`；`lk915` / `wB5R9` 对应 `loading` / `disabled`，`pXQHF` 为 primary 的 pressed 实例覆盖 |
| Field：`RdOeZ`；focus `E4X8Sy`、invalid `YHh32`、disabled `AkMWJ` | Field 的 `label/value/onValueChange/error/password/disabled` 与焦点状态；常驻标签、原生 Input 键盘避让 |
| Notice：`NwazT`、`Frvo0`、`oBr6h` | Notice `tone=neutral/error/success`；实际副作用完成后才显示成功 |
| StatePanel：`x9d5ZM`、`qVOVw`；错误恢复组合 `hi22J` | StatePanel `state=empty/loading/error`；可选 `onRetry`；错误组合引用同源 Notice 与 Button |
| Cell `sLLak` / Search `PuUE7` | 保留设计主组件；当前 shared/ui 未提供对应公共出口，后续按实际消费者就近实现 |
| Tabs：`a3t7jl` segmented / `M3Wfk` underline | 同源结构与标签覆盖；详情 `J1uPc`、目录 `M0zgBr` 是实例。当前没有小程序 Tabs 公共 export |
| Textarea `J2h2Z` / Switch `etGbJ`，off `NKXpw` | 基础输入/切换设计示例；当前没有对应小程序公共 export，不冒充已实现 API |
| Card `Kud7i`、页面表面、文字与纵向内容 | 已有 Card / Stack / Title / Body；Card 示例对应基础内容容器，不因示例分组而新增业务组件 API |
| Dialog `jiTpb`、ActionSheet `P9GNdx`、Disclosure `X4i5w` | 通用交互设计模式，当前无对应公共实现；接入时评估原生能力 |
| 搜索空态 `C61RN` | 引用 `x9d5ZM` 的实例 `xCW9T`，只覆盖图标、文案与局部布局，附清除搜索动作 |
| 图片预览 `MbfkW` / 账户替换 `K1y29c` | 保留已有本地选图与会话恢复所需的局部表达，不提升为公共 primitive |
| 可选 Select：`cFJsg`、`kENdM`、`Ri3NV`；Calendar：`TDPsU`、`fAxFb` | 无当前小程序消费者，仅位于非默认扩展参考；不是核心公共组件准入记录 |

## 宿主、主题与内容归属

宿主主组件仅在 Foundations 中维护：`TJU4R` 状态栏、`qFSqv` 导航、`gvLYz` 原生 TabBar 示意。页面通过引用和选中项覆盖消费，不再绘制另一套外壳。登录与详情没有一级 TabBar。

状态栏与导航尺寸只是取景示意，不是运行时常量。原生 TabBar 的安全区由微信管理，非 Tab 页按实际 inset 避让；不拼接固定安全区白块，也不取消运行时适配。安全区、窗口与胶囊以真实设备测量为准。

82 个变量保留三层别名及两主题值；颜色来自共享品牌源，移动几何读取 `tokens.scss`。Pen 的禁用透明度为 48%，对应运行时 0.48。系统字体、原生 inset 和 loading 动画不具有完整自动映射。没有新增跨文件库依赖或 Web 控件实现。

## 页面与状态行为

- 首页：组件入口进入组件 Tab，外观与账户进入我的。未配置服务时显示中性说明并禁用检查；请求中防重复触发，成功、失败和离线分别反馈；检查不修改业务数据。
- 目录：中文名或英文组件名搜索与分类取交集。切换分类保留搜索词，清除词恢复当前分类的完整列表；搜索无结果组合中的“清除搜索”沿用同一规则。无结果引用 `C61RN`，不当作网络失败。返回保留目录条件及位置。
- 输入体验：正常、错误、禁用共用一个体验区；聚焦与错误引用 Field。空白名称校验显示就近错误，有效输入只反馈本地校验成功。切回正常保留输入并清除预览错误。
- 图片：选择期间防重复触发，成功替换本地预览；取消或失败保留旧图，失败显示错误。`MbfkW` 表达预览与重新选择，不自动上传或发布。
- 我的：登录进入登录页；账户加载用内容级骨架，失败保留会话并允许重试。`K1y29c` 表达已登录区域，显示真实用户名。退出失败保留会话，成功清理凭据与查询缓存；本地清理失败仍须可见反馈。
- 外观：跟随系统、浅色、深色互斥，立即应用界面与原生宿主；持久化失败显示错误，不伪报保存。系统是偏好，实际主题仍为 Light / Dark。
- 登录：用户名不 trim，1–50 个 Unicode 字符；密码非空、UTF-8 不超过 72 字节且无孤立代理字符，来源为 `features/auth/validation.ts`。Label 常驻，密码掩码；错误保留输入。提交中禁用并防重复，服务缺失禁用登录，失败不提前跳转。保存凭据成功后清密码及缓存并返回，无上一页时进入我的。

## 通用交互边界

- Tabs 切换对应面板并保留输入；disabled 不响应，focus 可辨。Switch 以位置和文本表达状态；Textarea 保留标签。
- Dialog 说明对象、后果和恢复边界；取消、返回及遮罩不执行移除。ActionSheet 的移除项先进入确认，取消不执行动作；复制成功后才反馈成功。
- Disclosure 通过点按展开/收起，不依赖 hover 或自动消失。浮层的真实定位、安全区、滚动和操作可达性遵守移动 UI，不以规范板代替设备验证。
- 可选 Select 的分组标题不可选，禁用项保留原因；点选应用并收起，关闭或返回保留原值。Calendar 先更新待选日期，确认才应用，返回不提交；禁用日期不可选。六月日历为固定示例，不代表当前日期。

## 核验与交付

本次范围仅为源设计与必要文档；design-qa 用于适用的设计结构、规则及渲染检查，没有代码还原或原生交互测试对象，不运行无关浏览器/E2E。

| 检查 | 结果与边界 |
|---|---|
| 设计结构与引用 | passed：正式工具读取 8 个根维护单元、82 个变量；组件引用无缺失，变量无未定义引用，保存后独立 CLI 再次读取无悬空引用或未完成 placeholder |
| 布局 | passed：规范顶排、五页底排，无根画板重叠；保存文件在独立 CLI 中重新计算布局，规范区域无裁切告警。页面内容视口的首屏裁切是滚动取景，完整内容仍在原节点内 |
| 主题与视觉 | passed（已检查范围）：整体分区、Foundations / Interaction Patterns 两主题；首页、详情、我的、登录的 375 × 812 Light / Dark 和 390 × 844；UI / 目录由并行设计整理，持久化导出保留核心目录代表预览。没有执行所有内容 × 状态 × 主题的穷举矩阵 |
| 保存与重开 | passed：通过正式 `pen interactive --app desktop` 的 `save()` 保存指定源文件，再用独立 headless CLI 从该文件打开，核对根、实例、变量与布局并导出预览；没有用普通文件工具改写 `.pen` |
| 运行与还原 | not_run：没有运行应用、浏览器/E2E、小程序原生交互或代码还原测试。本次没有实现目标，不把源稿检查当成 design-to-code 还原通过 |
| 人工接受 | 本次整理尚无新增人工接受；不代填产品验收 |

交付预览来自保存后的同一来源，整体图使用临时 CLI 渲染容器合成，未写回源文件或增加维护画板：

- [整体画布](../design-system/previews/mobile-template/overview.png)
- [首页](../design-system/previews/mobile-template/Olawm.png)
- [组件展示中心](../design-system/previews/mobile-template/WEVoz.png)
- [通用组件详情](../design-system/previews/mobile-template/R6E697.png)

预览用于本次 PR 与后续定位，不替代 `.pen` 可编辑来源。主页面 PNG 为 2×，整体图为 1×；后续消费前仍应回读实际文件、主题与实例覆盖。
