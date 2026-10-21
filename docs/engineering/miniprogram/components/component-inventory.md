# 小程序组件清单

公开出口 [shared/ui/index.tsx](../../../../miniprogram/src/shared/ui/index.tsx)，样式为相邻 CSS Module。Props、类型和导出以源码为准，本页只维护能力与使用边界，不复制接口定义。

| 组件         | 用途与关键边界                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| PageShell    | 页面主题根、流式内容宽、原生主题同步和底部安全区；Tab 页显式声明 `withTabBar`，不重复补原生 TabBar inset |
| Button       | 主/次/危险操作；最小触控尺寸、按下态、loading/disabled；不提供假支付/分享等 open-type                    |
| Field        | 原生 Input、可见 Label、受控值、焦点/错误态、键盘避让；不是 Web Input 包装                               |
| Card / Stack | 表面与纵向内容组合；不承载业务状态或固定屏幕高度                                                         |
| Title / Body | 标题/正文角色、自然换行与辅助层级                                                                        |
| Notice       | 中性、错误、成功反馈；只有真实成功才能使用成功文案                                                       |
| StatePanel   | loading/empty/error 内容级状态；静态骨架与可选错误重试，不冻结整页                                       |

组件库可通过原生 TabBar 进入，搜索和分类卡定位到 `pages/demo/index` 的五组本地演示；基础控件保留输入校验，内容与列表展示 Feed 和列表单元，弹窗与弹层提供整页弹出交互，手势交互支持多条侧滑和拖动排序，示例不发业务写请求。展示页不是业务 PRD，也不是人工视觉验收证据。

新增能力先复用现有出口，再就近补充；只有稳定共享职责才抽取，不能为当前仅一个示例而删除模板基础组件。复杂日期/选择器等在有真实需求后评估官方/第三方组件的版本、主题和平台边界。

`core.lib.pen` 是 **Web 设计资产**；小程序使用独立的 [mobile.lib.pen](../../../design/design-system/mobile.lib.pen)。当前“版本 C”参考还原包含首页、组件库、我的三张静态样例页，以及基础组件演示和一张简版视觉规范页；规范不展示控件，主组件定义位于基础组件页的非展示来源组；覆盖范围、Frame ID、候选值、状态定位与映射见 [移动设计交接](../../../design/mobile/design-handoff.md)。

Cell/Search、Tabs、Switch、Checkbox、Radio、Badge 等在 `features/component-library` 和演示页面内组合，未提升为 shared/ui 公共出口，不能根据设计名称臆造 import。Button、Field、Card、Notice、StatePanel 与页面基础排版仍以本表现有接口为准；移动几何在 `tokens.scss` 中同步；页面图标和原生 TabBar 共用本地 Lucide 形状及生成配色。复杂 Select / Calendar、QueryComposer、分享不自动进入本次移动提案，Web 实现不受影响。

当前参考目录的类别、数量、收藏/最近使用和社区等按图片作静态样例，不当作真实统计、生产功能或新增运行时路由。设计覆盖不等于代码已实现，原生视觉与交互仍需开发者工具/真机验收。
