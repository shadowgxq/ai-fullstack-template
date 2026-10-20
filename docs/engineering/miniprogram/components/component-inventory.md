# 小程序组件清单

公开出口 [shared/ui/index.tsx](../../../../miniprogram/src/shared/ui/index.tsx)，样式为相邻 CSS Module。Props、类型和导出以源码为准，本页只维护能力与使用边界，不复制接口定义。

| 组件 | 用途与关键边界 |
|---|---|
| PageShell | 页面主题根、流式内容宽、原生主题同步和底部安全区；Tab 页显式声明 `withTabBar`，不重复补原生 TabBar inset |
| Button | 主/次/危险操作；最小触控尺寸、按下态、loading/disabled；不提供假支付/分享等 open-type |
| Field | 原生 Input、可见 Label、受控值、焦点/错误态、键盘避让；不是 Web Input 包装 |
| Card / Stack | 表面与纵向内容组合；不承载业务状态或固定屏幕高度 |
| Title / Body | 标题/正文角色、自然换行与辅助层级 |
| Notice | 中性、错误、成功反馈；只有真实成功才能使用成功文案 |
| StatePanel | loading/empty/error 内容级状态；静态骨架与可选错误重试，不冻结整页 |

组件页为本地工程展示，可通过原生 TabBar 进入；示例校验不发网络请求，选图只本地预览。展示页不是业务 PRD，也不是人工视觉验收证据。

新增能力先复用现有出口，再就近补充；只有稳定共享职责才抽取，不能为当前仅一个示例而删除模板基础组件。复杂日期/选择器等在有真实需求后评估官方/第三方组件的版本、主题和平台边界。

`core.lib.pen` 是 **Web 设计资产**；小程序使用独立的 [mobile.lib.pen](../../../design/design-system/mobile.lib.pen)。设计由 Foundations、UI Components、Interaction Patterns 和五个模板页面组成；覆盖范围、稳定 Frame ID、状态定位与映射见 [移动设计交接](../../../design/mobile/design-handoff.md)。

设计中的 Cell/Search、Tabs、Switch、Textarea、Dialog/ActionSheet/Disclosure 尚无当前 shared/ui 公共出口，不能根据设计名称臆造 import。Button、Field、Notice、StatePanel 与页面基础排版沿用本表现有接口。Select / Calendar 没有当前小程序消费者，仅保留在交互规范的非默认扩展参考中；不因存在主组件就成为模板公共 API。QueryComposer、分享预览不进入移动默认设计资产，Web 实现不受影响。

默认组件目录核心优先，交互及可选参考按分类进入；目录/详情仍为设计目标，不代表新增运行时路由。设计覆盖不等于代码已实现，原生视觉与交互仍需开发者工具/真机验收。
