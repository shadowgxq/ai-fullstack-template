# React 状态、请求与性能

适用于 React 组件、Hook、异步交互与性能修改；不替代 [组件 API](component-definition.md)、[UI 状态](accessibility-and-ui-states.md) 或 [模块出口](file-organization.md)。

本页提炼 [Vercel React Best Practices](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/SKILL.md) 中的请求瀑布、按需加载和渲染原则，按本仓库 React 18 + Vite + TanStack Query 落地，不要求安装完整 skill。`server-*`、RSC、`next/dynamic`、`React.cache` 和较新 React 专属 API 不进入当前基线；不为套用社区规则替换框架或缓存库。

## 状态与 Effect

Hook 只在组件或自定义 Hook 的顶层调用，不放条件、循环或普通工具函数；自定义 Hook 用 `use` 前缀，没有 Hook 的纯函数不包装成伪 Hook。共享 Hook 复用逻辑，不自动共享实例状态，见 [React Hook 复用](https://react.dev/learn/reusing-logic-with-custom-hooks)。

- render 保持纯净，不请求、写 store、改 DOM 或创建订阅/timer；不能在组件内部定义新的组件类型。模块级只提升真正静态的值，不提升依赖 locale、用户或主题的数据。
- 派生值直接计算；不要以 Effect 维护 props/query 的副本。共享状态归最近公共拥有者，编辑草稿明确初始化与重置条件。state 是只读输入，不原地 sort/splice query 或 props 数组。
- 用户触发的提交、分享和导航放事件/action；Effect 只同步外部系统，依赖完整，取消订阅与 timer。不要用 ref 标记“只跑一次”掩盖 StrictMode 暴露的清理问题。
- 基于旧 state 更新用 functional setState；需要呈现的状态不能藏在 ref。订阅 store 时取最小 selector；只在回调中读取的值不为了回调提前建立订阅。

依据：[React Effect 指南](https://react.dev/learn/you-might-not-need-an-effect)、[状态拥有者](https://react.dev/learn/sharing-state-between-components)。

## 请求与缓存

| 数据 | 拥有者 |
|---|---|
| 后端事实、请求状态和缓存 | TanStack Query；query/mutation 放对应 feature/entity model |
| 可分享/恢复的筛选、分页、tab | URL；确认解析、缺省与返回导航 |
| 表单草稿与短暂交互 | 组件局部状态；跨组件才上移 |
| 跨组件且不属于服务端/URL 的 UI 状态 | 项目现有 store；不复制 query 结果 |

query key 包含影响结果的参数及用户/scope；身份切换清理或隔离旧缓存。mutation 成功后显式更新或失效相关 cache，不只改当前 UI。组件不另建 request client，也不引入平行 SWR 层。

互不依赖的请求并行，有真实前置依赖才串行。全部成功才有效时可用 `Promise.all`；允许局部成功时独立 query 或显式聚合结果，不因一个失败把其他区域假报为空。

搜索与快速切换参数传递 `AbortSignal`，并确保迟到响应不能覆盖最新输入；仅调用 abort 不能假设所有 adapter 都会停止返回。使用 QueryComposer 时复用其公开搜索扩展点；实现其他搜索可参考 [内部搜索逻辑](../../../../frontend/src/shared/ui/QueryComposer/useQueryComposerSearch.ts) 的取消与竞态处理，不跨模块导入该私有 Hook。缓存语义按 [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys) 和 [Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation) 核对锁定版本。

## 交互边界

提交保护放统一 action / `onSubmit`，同时覆盖按钮、Enter 与快捷键；pending/disabled 是界面反馈，不代替 action guard 或服务端幂等。失败保留可重试输入，取消与失败区分。

debounce/throttle 只控制搜索、resize、scroll 等频率，不代替提交幂等；明确等待、取消和 leading/trailing。Effect 清理要取消待执行回调；全局监听避免逐实例重复注册，只在不需要 `preventDefault` 的监听中使用 passive。

## 性能顺序与模块边界

先处理多余请求/瀑布和首屏大依赖，再依据 Profiler 优化昂贵渲染。普通计算不默认包 `useMemo`；`useCallback` / memo 需要稳定依赖或真实消费者收益，不作为正确性修复。

重型图表、编辑器、图片导出按需求使用动态 `import()` 或 `React.lazy` + Suspense，并提供加载/失败边界；按键不流畅时再考虑 `useDeferredValue` / transition。transition 不等于 debounce，也不会减少网络请求。

模块内保持静态可分析 import。Vercel 的 barrel 建议不等于绕过 feature/widget 的公开 `index.ts`：保留本项目窄出口；primitive 按文件导入，重型第三方能力用其受支持入口。禁止为了优化导入库的未公开内部路径。

列表使用稳定业务 key；长列表只有真实瓶颈时才虚拟化，并检查键盘和滚动恢复。性能变更记录相同环境下的前后证据，不只凭 hook 数量或文件行数宣布优化。
