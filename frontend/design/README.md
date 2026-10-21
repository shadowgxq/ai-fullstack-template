# Web 设计规范与资产

适用于 `frontend/` 的 React/Vite Web，手机画布仍为 Web。微信小程序使用 [自己的设计入口](../../miniprogram/design/README.md)，不继承 Web 的 DOM、桌面布局和浮层规则。

## 规则归属

| 内容 | 唯一正文 |
|---|---|
| 视觉、信息层级与布局 | [Web UI 规范](ui-spec.md) |
| Web Token 选择、字体与几何 | [Token 政策](tokens.md)；值源为 [global.css](../src/shared/styles/global.css) |
| 平台、组件映射与宿主适配 | [Web 设计交接](design-handoff.md) |
| 跨端配色与通用交付接口 | [共享配色](../../docs/design/tokens.md)、[共同交付约定](../../docs/design/design-handoff.md) |
| 组件归属、复用与源码定位 | [组件治理](../../docs/engineering/frontend/components/components.md)、[组件清单](../../docs/engineering/frontend/components/component-inventory.md) |
| 状态、键盘、焦点与可访问性 | [UI 状态](../../docs/engineering/frontend/standards/accessibility-and-ui-states.md) |
| Theme / i18n 的运行接线 | [主题指南](../../docs/engineering/frontend/guides/theming-and-i18n.md) |

## 资产登记

| 资产 | 用途 |
|---|---|
| [core.lib.pen](core.lib.pen) | Signal Teal 的设计变量、基础控件、认证、分享和 QueryComposer 等模板共用能力 |
| [previews/](previews/) | Web 同名 Frame 的 Light 导出图；[dark/](previews/dark/) 为同源主题预览，不替代当前源稿 |

公共库独立维护变量与组件，不依赖业务设计资产。业务项目出现真实需求后，在本目录建立实际需要的消费稿，通过正式导入复用公共库，维护业务页面、流程、文案与数据；不复制公共色板，不为每次需求新增 Pen 文件。

仅 `MKpT9` Foundations 保留 Light / Dark 并排概览。`KNJdR` Semantic colors、组件规范与组合示例共用结构，通过 `mode=light/dark` 切换主题。操作、焦点、校验、选中与透明遮罩在相应组件规范区维护；默认保留 Light 主稿。主题表达与验证边界见 [共同交付约定](../../docs/design/design-handoff.md#深浅主题的设计表达)。已有预览不构成全量双主题导出的长期要求。

当前页面设计遵循 [桌面布局基准](ui-spec.md#布局与宿主)，不把组件规范板总宽度作为页面或控件尺寸。节点 ID、变量、主题、实例覆盖和库连接在使用前通过设计工具回读；预览与路径只能定位，不能证明当前连接或设计已被接受。代码对应关系见 [组件清单](../../docs/engineering/frontend/components/component-inventory.md#pencil-定位与映射)。

设计示例不证明登录、权限、分享副作用或人工验收已完成。实际任务进度与验证证据在对应 PR/change 记录，不维护另一套长期执行台账。

复制模板后沿用、清理指定示例或更换视觉体系，按 [视觉初始化](../../docs/engineering/frontend/guides/project-bootstrap.md#复制模板后的视觉初始化) 处理。工程规范仍归 `docs/engineering/frontend/`；本端 `design/` 不复制产品需求、共享契约或交付工作流。
