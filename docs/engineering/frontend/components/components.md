# Components

组件治理入口：决定复用、扩展、就近新增或提升层级。具体文件命名、组件 API、状态规则不在此重复维护。

| 问题 | 唯一事实源 |
|---|---|
| 当前已有组件和调用边界 | [组件清单](component-inventory.md) |
| 拆分步骤与案例 | [组件拆分](component-splitting.md) |
| 文件命名、目录和公开出口 | [文件组织](../standards/file-organization.md) |
| props 与 UI primitive 契约 | [组件定义](../standards/component-definition.md) |
| loading、错误、焦点和键盘 | [UI 状态](../standards/accessibility-and-ui-states.md) |

## 决策顺序

1. 先查已有组件；仅缺少兼容的小能力时扩展现有组件，不新建近似副本。
2. 新边界必须有明确名称、职责、独立交互/测试价值或重复结构；不为了减少行数拆出透传层。
3. 新的单场景组件先就近放置；出现两个稳定场景且不含业务语义后，再考虑提升到 shared。已有模板公共组件无需因当前示例只有一个调用方而删除。
4. 只有视觉重复时提取 token/样式；只有计算或选项映射重复时提取 utility/typed constants，不强行抽 UI。

## 层级判断

| 层级 | 职责 |
|---|---|
| page-private | 当前页面独有的交互和展示 |
| widget | 页面级组合区域，例如 AppShell |
| feature | 用户动作、流程与副作用，例如分享 |
| entity | 领域对象展示、领域转换 |
| shared UI | 无业务基础交互，不包含接口 DTO、权限、产品文案或业务枚举 |

依赖方向以 [技术基线](../architecture/technology-options.md#依赖方向) 为准。中间组件不得只透传 props；下层不能反向读取调用方的路由、业务 store 或 request client。

## 清单维护

稳定 UI 组件新增、移除或职责改变时同步 [组件清单](component-inventory.md)。记录入口、职责、消费者与废弃替代关系；不登记尚未实现的设想，不重复列出 route/app 入口和工具函数。
