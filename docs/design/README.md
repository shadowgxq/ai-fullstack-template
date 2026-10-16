# 设计规范与资产

目标包为 `frontend/`，平台为 React/Vite Web，覆盖桌面键盘/鼠标与手机触控。任务选择见 [前端导航](../engineering/frontend/README.md#任务路径)。模板提供通用设计基础与现有能力示例；使用方业务由自己的需求和契约定义。

## 规则归属

| 内容 | 唯一正文 |
|---|---|
| 视觉方向、信息层级与布局 | [UI 规范](ui-spec.md) |
| Token 选择与设计同步 | [Token 政策](tokens.md)；运行时数值、别名与主题值在 [global.css](../../frontend/src/shared/styles/global.css) |
| 平台、宿主适配与交付接口 | [设计交付约定](design-handoff.md) |
| 组件复用、归属与拆分 | [组件治理](../engineering/frontend/components/components.md) |
| 组件可见性与设计定位 | [组件清单](../engineering/frontend/components/component-inventory.md)；API 以源码 export/类型为准 |
| 状态、键盘、焦点与可访问性 | [UI 状态](../engineering/frontend/standards/accessibility-and-ui-states.md) |
| Theme / i18n 的运行接线 | [主题指南](../engineering/frontend/guides/theming-and-i18n.md) |
| 业务与服务能力 | 使用方 [产品需求](../product/README.md) 与 [跨端契约](../contracts/README.md) |

通用动作由全局安装、同一来源的 `ui-ux-delivery`、`pencil-design`、`design-to-code`、`design-qa` 与 `DESIGN-WORKFLOW.md` 维护；本目录不保存执行 Skill 或项目绑定副本。全局来源与读取入口见 [工具入口](../engineering/workflow/tooling.md#安装与唯一机制)。

复制模板后沿用、清理指定示例或更换视觉体系，统一按 [视觉初始化](../engineering/frontend/guides/project-bootstrap.md#复制模板后的视觉初始化) 处理；本页登记当前资产，不把模板示例当作使用方业务的已批准设计。

## 资产登记

模板仅维护一个可编辑设计文件：`design-system/core.lib.pen`。公共库包含 Design Tokens、基础控件、认证、分享和 QueryComposer 及其必要状态；业务项目出现真实需求后再创建自己的业务消费稿，不预留空业务设计文件。

| 资产 | 用途 |
|---|---|
| [design-system/core.lib.pen](design-system/core.lib.pen) | Signal Teal 的 75 个设计变量、公共组件、模板共用能力及必要状态 |
| `design-system/previews/` | 同名 Frame 的 Light 导出图；`dark/` 为同一结构切换主题后的预览 |

公共组件按维护单元独立定位，认证、分享和查询组合保留各自真实契约。设计主组件和展示画板不决定 React 的模块位置或公开 API，当前设计覆盖与源码映射见 [组件清单](../engineering/frontend/components/component-inventory.md#pencil-定位与映射)。

公共库独立维护变量与组件，不依赖业务设计资产。后续业务消费稿通过正式导入复用公共库，负责实际业务页面、流程、文案与数据；不复制公共色板，也不为每次需求新增设计文件。公共准入与运行时归属见 [组件治理](../engineering/frontend/components/components.md)。

仅 `MKpT9` Foundations 保留 Light / Dark 并排概览。`KNJdR` Semantic colors、组件规范与组合示例使用单份结构，选中画板后切换 `mode=light/dark` 查看主题，不另设关键状态对照板。操作、焦点、校验、选中与透明遮罩在各组件规范区维护。默认保留 Light 主稿；必要的 Dark 预览从同一 Frame 导出，预览随受影响主稿同步。两主题渲染与运行时验证的边界见 [设计交付约定](design-handoff.md#深浅主题的设计表达)。

页面设计遵循 [桌面布局基准](ui-spec.md#布局与宿主)；组件规范板的总宽度不决定页面或控件尺寸。节点 ID、变量、主题、实例覆盖和库连接在使用前通过设计工具回读；预览与路径只能定位，不能代替当前源稿。

示例数据和操作反馈是设计表达，不能证明登录、权限、剪贴板、图片导出、投递或人工验收。实际进度与验证证据放在对应 change / PR / 交接中，不维护另一套长期执行台账。
