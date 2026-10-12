# 设计规范与资产

目标包为 `frontend/`，平台为 React/Vite Web，覆盖桌面键盘/鼠标与手机触控。任务选择见 [前端导航](../engineering/frontend/README.md#任务路径)。模板提供通用设计基础与现有能力示例；使用方业务由自己的需求和契约定义。

## 规则归属

| 内容 | 唯一正文 |
|---|---|
| 视觉方向、信息层级与布局 | [UI 规范](ui-spec.md) |
| Token 选择、准入与设计投影 | [Token 政策](tokens.md)；数值、别名与主题值在 [global.css](../../frontend/src/shared/styles/global.css) |
| 平台、宿主适配与交付接口 | [设计交付约定](design-handoff.md) |
| 组件复用、归属与拆分 | [组件治理](../engineering/frontend/components/components.md) |
| 组件可见性与设计定位 | [组件清单](../engineering/frontend/components/component-inventory.md)；API 以源码 export/类型为准 |
| 状态、键盘、焦点与可访问性 | [UI 状态](../engineering/frontend/standards/accessibility-and-ui-states.md) |
| Theme / i18n 的运行接线 | [主题指南](../engineering/frontend/guides/theming-and-i18n.md) |
| 业务与服务能力 | 使用方 [产品需求](../product/README.md) 与 [跨端契约](../contracts/README.md) |

通用动作由全局安装、同一来源的 `ui-ux-delivery`、`pencil-design`、`design-to-code`、`design-qa` 与 `DESIGN-WORKFLOW.md` 维护；本目录不保存执行 Skill 或项目绑定副本。全局来源与读取入口见 [工具入口](../engineering/workflow/tooling.md#安装与唯一机制)。

## 资产登记

深浅主题的主组件、页面展示与检查按 [主题表达约定](design-handoff.md#深浅主题的设计表达) 维护。下列现有 Light / Dark 展示或预览用于定位，不是要求每个新增组件和页面都成对产出的模板。

| 资产 | 用途 |
|---|---|
| [design-system/core.lib.pen](design-system/core.lib.pen) | 公共设计库；Signal Teal 的 74 个设计变量、已准入控件及必要用法与状态示例，按维护单元独立定位 |
| [business.pen](business.pen) | 业务消费稿；认证、分享、应用壳、组件目录与 Select 详情页，以及公共契约待明确的 Calendar / QueryComposer；导入公共库 |
| `design-system/previews/`、`previews/` | 当前主稿及必要主题对照的导出图；各自的 `dark/` 子目录是同一 Frame 切换主题后的预览，不是另一份可编辑源 |

默认维护这两个可编辑设计文件：公共库提供 Tokens、基础 UI 与通过 [公共准入](../engineering/frontend/components/components.md#公共层准入) 的通用交互组件；`business.pen` 承担业务组合、布局、页面及通用性未明确的组件，使用方直接在消费稿中演进，不默认新增第三份组合库。

公共库不依赖消费稿的变量或主组件；业务主组件可以在消费稿内复用，并继续引用公共控件和变量。设计主组件数量不决定 React 组件数量，feature/widget 的公开出口也不等于公共设计系统成员。当前归属、节点与代码边界见 [组件清单](../engineering/frontend/components/component-inventory.md#归属与复用边界)。

公共稿展示组件契约和必要用法，业务稿展示真实功能与页面。示例容器不自动成为主组件；业务稿不再维护一套完整的公共控件规范目录。组件目录页的“基础 / 高级”分类是页面导航，不是设计归属规则。

组件规范区与业务页面默认保留 Light 主稿，Dark 预览使用同一 Frame ID 导出到对应 `previews/dark/`。公共颜色配对板及 `ywtIg` 关键状态板保留同源双主题对照，集中表达操作、焦点、校验、选中和透明遮罩；业务稿不维护第二张完整 Dark 目录页，也不在 QueryComposer 状态主稿中重复铺设 Dark 行。预览随受影响主稿同步，两主题渲染与运行时验证的边界按交付约定记录。

页面示例遵循 [桌面布局基准](ui-spec.md#布局与宿主)；组件规范板和状态目录用于展示复用关系，画布总宽度不决定页面或控件尺寸。

资产名称和路径只提供定位。导入别名、库身份、节点 ID、主题和覆盖在使用前通过工具回读；预览随获授权的设计修改更新。移动或另存后核对相对库/图片路径，并在最终目录重开消费者确认连接。

示例数据和操作反馈是设计表达，不能证明登录、权限、剪贴板、图片导出、投递或人工验收。实际进度与验证证据放在对应 change / PR / 交接中，不维护另一套长期执行台账。
