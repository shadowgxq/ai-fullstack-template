# 前端编码入口

前端实现读取 [公共代码质量](../../common/code-quality.md) 与本页；组件、Hook 或请求数据流再读 [React 规则](react-patterns.md)。不要求纯文档任务加载全部代码规范。`src/` 指 `frontend/src/`。

## TypeScript 差异

- 变量与函数用 `camelCase`，组件和类型用 `PascalCase`；默认 `const`，需要重赋值才用 `let`，不新增 `var`。自定义 Boolean 保留公共命名语义；原生/第三方 props 保留 `disabled`、`open` 等契约名。
- props、Hook 参数、store state、API 边界和公开函数返回值有明确类型；不新增 `any`，不可信数据从 `unknown` 收窄，不用 `as`、非空断言或 `@ts-ignore` 代替校验。
- DTO 按提供方契约命名并与 UI model 区分；只在字段/语义确有差异处转换，不为相同内部数据复制多套类型。HTTP 泛型不是运行时验证，关键未知字段在 API/model 边界处理。
- 有限状态默认 `as const` 推导 union；默认不新增 `enum`，仅保留生成 SDK 或明确互操作需要的例外。派生映射用 `Record` / `satisfies` 检查覆盖；受控 union 分支穷尽，不可信外部值先处理未知情况。
- 未知展示值可以有明确 fallback；权限、状态迁移或金额等关键字段不允许兜底成有效业务值。UI-ready 类型不携带密码、内部 token 或完整供应商响应。

## 规则落点

| 影响面 | 唯一细则 |
|---|---|
| React 纯渲染、state、Effect、请求、性能 | [React 规则](react-patterns.md) |
| 复用/扩展/拆分组件 | [组件治理](../components/components.md)，先核对 [真实清单](../components/component-inventory.md) |
| props、受控状态、primitive 行为 | [组件 API](component-definition.md) |
| 分层与 public import | [技术基线](../architecture/technology-options.md#依赖方向)、[文件组织](file-organization.md) |
| UI、表单、焦点、键盘与失败反馈 | [UI 状态](accessibility-and-ui-states.md) |
| 样式、文案、主题 | [theme / i18n](../guides/theming-and-i18n.md) |
| 配置、Vite 与代理 | [配置指南](../guides/runtime-config-and-vite.md) |

默认保留 theme/i18n；opt-out 按主题指南完整修改实现、依赖与文档，不只删除接线。样式采用已配置的 Tailwind/CSS Variables 与 `cn()`，不创建平行 token、Provider 或请求 client。

## 受影响验证

修改 TS/TSX 时按 [前端 README](../../../../frontend/README.md) 执行项目 typecheck、受影响文件 ESLint 与相邻行为测试；不以 `tsc <file>` 代替项目检查。

| 变化 | 重点复核 |
|---|---|
| DTO、枚举或数据流 | 缺失/未知值、错误归一化、缓存隔离与更新 |
| 表单、异步交互 | 连续点击、键盘提交、pending、失败重试、取消与迟到响应 |
| 共享组件 API | 真实直接消费者及兼容场景，至少覆盖受影响的正常和失败/禁用状态 |
| 样式或布局 | 响应式、文字溢出、焦点与主题；不为纯 CSS 机械补单测 |
| 性能优化 | 优化前后的请求/包体/Profiler 证据与行为不回归 |

范围无法收窄或修改工程配置时再扩大检查；build、启动和全栈验证仍受 [公共验证范围](../../common/README.md#验证范围) 与命令授权约束。
