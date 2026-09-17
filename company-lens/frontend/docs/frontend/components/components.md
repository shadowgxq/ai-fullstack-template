# 组件拆分与 API

已有组件见[组件索引](component-inventory.md)；目录和命名见[文件组织](../standards/file-organization.md)，状态和可访问性见[交互规则](../standards/accessibility-and-ui-states.md)。

## 拆分与复用

先确认状态归属、数据流与稳定 UI 边界，再决定组件。优先复用已有实现，缺少小能力时兼容扩展；一次性业务区块就近放置。只有跨场景稳定复用且无业务语义时才进入 shared UI。

| 要拆的内容 | 落点 |
|---|---|
| 页面专属区块 | page-private UI |
| 页面级组合区域 | widget |
| 用户动作或流程 | feature |
| 领域对象展示 | entity |
| 无业务通用交互 | shared UI |
| 可复用的状态/副作用 | 就近 custom hook |
| 纯转换、格式化或计算 | 普通函数 |
| 相同颜色、间距、视觉 | token 或样式，无需新组件 |

组件有独立语义、交互、状态或维护价值时拆分；不因行数或少量标签机械拆分。若子组件只透传 props，先检查状态归属与组合方式。权限、业务文案、query key、mutation 和 DTO 留在拥有相应语义的层。

## Props 与状态合同

- Props 显式类型，Boolean 使用 is/has/can/should，事件使用 onXxx；多变体使用 variant/size/tone 等 union，避免互斥 Boolean。
- 可控 value/onChange 与非可控 defaultValue 分清，不隐式复制 props 为第二状态源；编辑草稿须明确提交/取消语义。
- 复杂内容用 children 或具名组合边界，避免堆叠字符串参数。
- 可复用组件按需支持 className、ref；shared UI 不依赖业务字段、API DTO 或路由上下文。
- mutation 状态由调用方持有，组件呈现 pending/disabled 并阻止重复交互；异步失败保留可恢复状态。
- 请求、DTO 转换和缓存行为属于 API/model/query 边界，UI 不创建 request client。

## 实现约定

命名组件使用 `ComponentName/ComponentName.tsx`、CSS Module 和公开 `index.ts`。纯页面/应用入口保持原结构，不为了组件统计强行拆分。

render 保持纯净，不在 render 内定义子组件或重复创建静态配置。优先语义 HTML；复杂浮层复用现有 primitive，不能只包装外观而丢失键盘或焦点合同。

样式引用语义 token；组件外部间距由调用方负责，内部状态可使用 data-state、aria-invalid、disabled。共享第三方能力只有在实际多处重复时才建立适配封装。

新增稳定复用组件时更新索引的职责和源码位置；不维护每个页面私有区块的手工统计。需要更多拆分例子时查阅[上游案例](../../archive/component-splitting-examples.md)，示例不是本项目新增能力要求。
