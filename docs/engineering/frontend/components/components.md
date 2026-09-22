# 组件复用与治理

本页只维护 UI 的复用选择和层级归属；通用抽象原则见 [公共代码质量](../../common/code-quality.md#复用与抽象)，组件 API 看 [组件定义](../standards/component-definition.md)，状态行为看 [UI 状态](../standards/accessibility-and-ui-states.md)。

## 决策顺序

先查 [现有组件清单](component-inventory.md) **和源码的真实 export / props / 调用点**：同业务现有实现 → 项目 shared UI → 既有组合模式 → 已安装 primitive 的最小封装 → 就近新增。已经用 shadcn/Radix 的项目不因为社区示例就再引入另一套 UI 库。

兼容扩展优先于近似副本；新 props 不改变现有缺省行为，也不为单个消费者加入 `isProjectA` 一类业务开关。公开参数改变时查所有直接消费者；不修改第三方生成结构来绕过现有包装层。

## 放在哪一层

| 层级 | 拥有的职责 | 不下沉 |
|---|---|---|
| page-private | 当前页面特有的展示和交互 | 无稳定复用时不移到全局 |
| widget | 页面级组合区域，例如 AppShell | 页面导航不塞进 shared |
| feature | 用户动作、流程和副作用，例如分享 | mutation/权限不塞进 Button |
| entity | 领域对象展示、转换与领域类型 | 跨领域只是外观相似时不共享领域规则 |
| shared UI | 不含产品语义的基础交互 | 业务 DTO、路由、store、权限和固定产品文案 |

下层由 props/回调接受数据与动作，不能反向读取调用方。依赖方向见 [技术基线](../architecture/technology-options.md#依赖方向)；具体组件/Hook/纯函数的拆法与 QueryComposer、ShareDialog、AppShell 案例见 [组件拆分](component-splitting.md)。

## 共享 API 的交付

复用前检查受控/非受控模式、ref、键盘/焦点、pending、错误和主题契约，不只比较截图。修改公共 API 后验证受影响消费者：有多个真实场景时选至少两个代表场景；只有一个时用该消费者及新增边界用例，不虚构第二个业务。

新增、删除或职责改变时同步 [组件清单](component-inventory.md) 的入口、职责和使用场景；props 以 TypeScript 为准，不写第二份类型。可用的通用演示组件保留，不将“只有演示调用者”当成删除依据。
