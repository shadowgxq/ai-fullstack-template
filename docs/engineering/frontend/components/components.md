# 组件复用与治理

本页维护 UI 的复用、归属、抽取与提升；通用抽象原则见 [公共代码质量](../../common/code-quality.md#复用与抽象)，组件 API 看 [组件定义](../standards/component-definition.md)，状态行为看 [UI 状态](../standards/accessibility-and-ui-states.md)。

## 决策顺序

先查 [现有组件清单](component-inventory.md) **和源码的真实 export / props / 调用点**：同业务现有实现 → 项目 shared UI → 既有组合模式 → 已安装 primitive 的最小封装 → 就近新增。已经用 shadcn/Radix 的项目不因为社区示例就再引入另一套 UI 库。

相同契约优先使用现有组件，不建立近似副本。先核对行为、状态、插槽、受控模式与主题是否满足任务，再决定复用或组合，不能只比较截图。不为单个消费者加入 `isProjectA` 一类业务开关，不修改第三方生成结构来绕过包装层。视觉见 [UI 规范](../../../design/ui-spec.md)，Token 选择见 [政策](../../../design/tokens.md)。

新增前明确数据依赖、状态拥有者、副作用和真实共享需要；公共 API/缺省行为变更检查全部直接消费者。Pen 的主组件、变体与 Frame 数量不决定 React 组件数量，Card/ListItem/Feedback 可以保持组合模式。

## 放在哪一层

| 层级 | 拥有的职责 | 不下沉 |
|---|---|---|
| page-private | 当前页面特有的展示和交互 | 无稳定复用时不移到全局 |
| widget | 页面级组合区域，例如 AppShell | 页面导航不塞进 shared |
| feature | 用户动作、流程和副作用，例如分享 | mutation/权限不塞进 Button |
| entity（按需） | 稳定领域对象展示、转换与领域类型 | 不创建空层，不因外观相似共享领域规则 |
| shared UI | 不含产品语义的基础交互 | 业务 DTO、路由、store、权限和固定产品文案 |

下层由 props/回调接受数据与动作，不能反向读取调用方。依赖方向见 [技术基线](../architecture/technology-options.md#依赖方向)。业务组件被多个页面使用仍可属于 feature/entity；通用控件也不因只有一个调用点失去通用性。

## 抽取方法

仅在有稳定语义、独立状态/交互、明显重复或真实共享需要时拆分，不按文件行数或设计图层拆文件。

1. 识别独立职责区域，例如筛选条、交互行、字段组与浮层。
2. 确认状态拥有者及输入/输出，共享状态与草稿按 [React 规则](../standards/react-patterns.md#状态与-effect) 处理。
3. JSX 与可访问性交互用组件；订阅、状态与 Effect 用 Hook；无 React 状态的计算用纯函数。
4. 就近实现，按真实 props、事件和必要状态验证；公开出口与目录按 [文件组织](../standards/file-organization.md)。

少量静态标签、没有独立语义/交互或只负责透传全部 props 的壳先留在父组件；props 持续增加时先检查状态拥有者和组合方式。

| 场景 | 合理边界 | 避免 |
|---|---|---|
| 列表、表格、详情 | 筛选/排序/选择/分页与交互行，页面负责组合 | 每个字段或静态表头都抽组件 |
| 表单与危险操作 | feature model 管提交/错误，表单管跨字段状态，Dialog 管浮层 | 权限、业务校验或 mutation 下沉到 Input/Button |
| 菜单、Tabs、布局 | primitive 管交互，page/widget 管路由、选项和权限 | shared 固化业务路由 |
| 搜索、虚拟列表、分页 | model 管请求，组件管测量和条目交互 | item renderer 发业务请求，Hook 隐藏 Effect 依赖 |
| Loading / Empty / Error | 通用表达接收内容/action，业务解释留在调用方 | 固化资源名或权限文案 |
| 第三方库 | 在实际使用边界封装交互、样式与 API | 为单 feature 预建全局 adapter 框架 |

## 现有边界与提升

- **QueryComposer**：shared UI 负责输入/键盘/候选层；`useQueryComposerSearch` 管 debounce、AbortSignal 和过期响应；适配器、候选类型及提交由消费者注入。
- **ShareDialog**：浏览器分享副作用属于 feature；model 管动作/文案，adapter 调浏览器 API，UI 管预览/菜单，poster 由消费者传入。
- **AuthForm / LoginModal**：账号字段与认证流程属于 auth feature，组合共享字段/浮层；gateway 和能力开关决定实际入口，不把认证请求或权限下沉到 Input。
- **AppShell**：导航、设置与弹窗装配属于 widget；复用 Button/Menu 不把账户或路由下沉。

页面私有领域卡片出现稳定跨页复用时，可按语义提升到 entity 或所属 feature；去除领域依赖并有稳定跨领域契约后才进入 shared。纯函数如 `sortResourcesByName` 不加 `use`；订阅 Hook 按目的命名如 `useOnlineStatus`，不以 `useMount` 隐藏依赖。

## 共享 API 的交付

共享契约变更须在当前范围内，先检查真实消费者，再同步实现、演示与必要测试。获授权删除 props/Token 时一次性同步消费者，不保留旧别名；业务兼容、身份与版本语义不因此删除。

修改公共 API 后验证受影响消费者：有多个真实场景时选至少两个代表场景；只有一个时用该消费者与必要边界用例，不虚构第二个业务。确认下层没有业务 DTO/路由反向依赖，键盘与异步失败按状态规范核验。

新增、删除或职责改变时同步 [组件清单](component-inventory.md) 的入口、职责和使用场景；props 以 TypeScript 为准，不写第二份类型。可用的通用演示组件保留，不将“只有演示调用者”当成删除依据。

方法参考：[Thinking in React](https://react.dev/learn/thinking-in-react)、[Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)。
