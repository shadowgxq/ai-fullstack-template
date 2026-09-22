# Component Splitting

本页只说明拆分方法与案例。是否抽取/提升层级见 [治理入口](components.md)，路径规则见 [文件组织](../standards/file-organization.md)。

## 操作步骤

1. 根据页面层级识别稳定区域，例如筛选条、列表项、表单字段组、浮层。
2. 确认每个区域的状态拥有者与输入/输出，按 [React 状态规则](../standards/react-patterns.md#状态与-effect) 处理共享状态与草稿。
3. 按复用内容选择形态：JSX 与可访问性交互用组件；订阅、状态与 Effect 用 hook；无 React 状态的计算用纯函数。
4. 就近实现并用 props、测试数据和事件验证关键状态；不要为行数目标创建壳层。

## 保留在父组件的信号

只是少量静态标签、没有独立语义/交互，或拆出后只负责把所有 props 继续下传时，先保留。props 不断增加时先检查状态拥有者和组合方式，而不是不断添加容器。

## 代表性案例

| 场景 | 合理边界 | 不应做什么 |
|---|---|---|
| 列表、表格、详情、Dashboard | 独立筛选/排序/选择/分页区域和交互行；页面只负责组合 | 静态表头和每个字段都单独抽组件 |
| 表单与危险操作 | feature model 负责提交/错误映射；表单管理跨字段状态；Dialog 负责浮层 | 把权限、业务校验或 mutation 放入 Input/Button |
| 菜单、Tabs、布局 | primitive 管交互；page/widget 管路由、选项、权限与页面内容 | 把业务路由写进 shared Tabs 或布局 |
| 搜索、虚拟列表、无限滚动 | model 管请求和分页；组件管测量、候选/条目交互 | 把业务请求放进 item renderer，或隐藏 Effect 依赖 |
| Loading / Empty / Error | 通用外壳接收内容和 action；业务解释留在使用方 | 把资源名称和权限提示固化成 shared 空态 |
| 第三方库 | 在实际使用边界封装交互、样式与稳定 API | 为仅一个 feature 使用的库预建全局 adapter 框架 |

## 本模板的三个边界

- **QueryComposer**：输入/键盘/候选层属于 shared UI；`useQueryComposerSearch` 管 debounce、AbortSignal 和过期响应；搜索适配器、候选类型及提交动作由消费者注入。
- **ShareDialog**：分享是带浏览器副作用的 feature。`model` 管动作状态和文案组装，`adapter` 调浏览器 API，`ui` 管预览和菜单；产品海报通过 `poster` 传入。
- **AppShell**：导航与设置是 widget，不进入 shared；不因复用 Button、DropdownMenu 就把账户、权限和业务路由下沉。

## 提升层级示例

一个页面的 `ProjectCard` 先留在 page-private。第二个页面复用同一领域展示时，可提升到 `entities/project`；只有多个领域共享且已去除领域字段的外观壳，才进一步提取为 shared primitive。不要一步跳到万能 Card。

纯排序函数命名为 `sortResourcesByName`，不加 `use` 前缀；订阅 hook 应以目的命名，例如 `useOnlineStatus`，不要用 `useMount` 隐藏真实依赖。

## 复核

确认边界职责独立、状态单一、下层不依赖业务 DTO/路由、键盘与异步失败可验证。组件目录、公开出口与登记按对应事实源执行，本页不再复制检查清单。

参考：[Thinking in React](https://react.dev/learn/thinking-in-react)、[Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)。
