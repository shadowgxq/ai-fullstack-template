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

通用动作由同一 Skills 来源的 `pencil-design`、`design-to-code`、`design-qa` 与 `DESIGN-WORKFLOW.md` 维护；本目录不保存执行 Skill 或项目绑定副本。来源、锁定版本与安装入口见 [Skill 来源与安装](design-handoff.md#skill-来源与安装)。

## 资产登记

| 资产 | 用途 |
|---|---|
| [design-system/core.lib.pen](design-system/core.lib.pen) | Signal Teal 的 Light / Dark、75 个公共设计变量、颜色配对与统一字体/间距/圆角、现有公共控件与 QueryComposer 状态；组件尺寸在对应上下文记录来源 |
| [examples.pen](examples.pen) | 1440px 桌面组件目录、全部 15 个 demo 入口的 Light / Dark 展示、认证与分享组合；通过真实导入消费公共库 |
| `design-system/previews/`、`previews/` | 对应设计的导出图；不是另一份可编辑源 |

公共库不依赖示例或业务变量/主组件；认证、分享、导航与页面组合留在消费稿，业务复用不自动升级为 shared。设计主组件数量不决定 React 组件数量；Card、ListItem、Feedback 可以是内容组合模式。

页面示例遵循 [桌面布局基准](ui-spec.md#布局与宿主)；组件规范板和状态目录用于展示复用关系，画布总宽度不决定页面或控件尺寸。

资产名称和路径只提供定位。导入别名、库身份、节点 ID、主题和覆盖在使用前通过工具回读；预览随获授权的设计修改更新。移动或另存后核对相对库/图片路径，并在最终目录重开消费者确认连接。

示例数据和操作反馈是设计表达，不能证明登录、权限、剪贴板、图片导出、投递或人工验收。实际进度与验证证据放在对应 change / PR / 交接中，不维护另一套长期执行台账。
