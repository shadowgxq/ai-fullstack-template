# Accessibility And UI States

UI 状态、交互反馈和可访问性硬规则。

## 状态规则

| 状态        | 必须满足                               |
| ----------- | -------------------------------------- |
| `loading`   | 避免布局剧烈跳动。                     |
| `empty`     | 说明当前为空，并按场景给下一步操作。   |
| `error`     | 显示用户可理解反馈，不只写 console。   |
| `disabled`  | 同时阻止交互并表达不可用原因。         |
| `readonly`  | 内容保持可见，只限制编辑。             |
| `pending`   | 防重复提交，并保留清晰文案或进度提示。 |
| `success`   | 对用户任务结果给可见反馈。             |
| `no access` | 不显示误导性可执行入口。               |
| `stale`     | 保留可用内容并明确时效，刷新失败不伪装首次空态。 |

- 异步提交失败后应恢复可操作状态，并保留用户已输入内容。
- 状态变化影响任务结果时，必要时使用合适的 live region。
- loading/pending 图标不能是唯一表达，必要时配合 `aria-busy`、可见文本或状态区域。
- 首次失败与已有内容刷新失败分别表达；只覆盖实际可能发生的状态，含义由产品/契约决定。

## 交互控件

- 可点击元素优先使用 `button`、`a` 或原生控件。
- 表单外普通按钮显式设置 `type="button"`；提交按钮用 `type="submit"`，并在 form `onSubmit` 统一防重复。
- 真正不可操作的控件优先用原生 `disabled`。
- 使用 `aria-disabled` 时，handler 中仍必须阻止动作。
- 图标按钮必须有可访问名称，例如 `aria-label`。
- 颜色不能作为唯一状态表达；focus 样式不能移除，除非有等价替代。
- Button 核对 default / hover / pressed / focus-visible / disabled / loading；长标签用合理换行和最小高度承载，不固定高度裁剪。
- Input/Select 区分 focus、disabled、readonly、invalid；Switch/Tabs 区分已选、未选、禁用与键盘焦点。
- 提交保护由 form/action 与控件共同承担；UI 防重复不能代替业务幂等。

## 表单和浮层

- 表单字段应有 label、description 或 error message。
- 表单错误使用可见文案，并按场景用 `aria-invalid`、`aria-describedby` 关联。
- dialog 必须有 title，必要时有 description。
- menu、popover、select、tooltip 优先复用 shared UI，避免重复实现键盘交互。
- overlay 打开时应有明确焦点入口；关闭后焦点回到合理触发点。
- Dialog 支持合理的 Escape 关闭；必需流程限制关闭时说明依据并提供退出方式。viewport 限制内容时内部滚动，操作不能被裁掉。

## ARIA 和键盘

- 优先使用原生 HTML 语义；原生语义无法表达时才添加 role 或 ARIA。
- 使用自定义 role 时，必须实现对应键盘、焦点和状态行为。
- 键盘用户必须能完成主要路径，不能出现无法进入或无法退出的 focus trap。
- 动画和过渡不应阻断交互；明显动态效果应尊重 `prefers-reduced-motion`。

## 响应式和文本

- 文本不能溢出按钮、卡片、表格单元或浮层容器。
- 固定格式组件需要稳定尺寸或响应式约束。
- 移动端检查换行和触控面积；图标按钮不能只依赖视觉图标尺寸。
- 不使用 viewport width 直接缩放字体。
- 视觉密度与命中区域分别核对；触控目标依据正式 `--control-hit-size` 和实际点击容器，伪元素的视觉/命中表达需验证，不能用相互重叠的区域凑尺寸。
- 检查明暗主题、长中文/英文、内容增长、字体回退、200% 文本缩放与粗指针；触控输入不以缩小字体挤入布局。
- 页面无横向溢出；宽表在具名、可聚焦的局部容器滚动，不裁剪隐藏内容。
- 正文和操作文字按 4.5:1、必要控件边界和状态按 3:1 核对；装饰分隔不能作为唯一可辨识边界。设计尺寸与截图不能证明实际 Web 行为或对比度已经通过。

依据：[文字对比](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)、[非文字对比](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)、[目标尺寸](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)。项目目标与 WCAG 最低要求/例外分别核验。
