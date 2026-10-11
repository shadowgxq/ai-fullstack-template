# 前端专项导航

`src/` 指 `frontend/src/`。公共协作约束继承 [根 AGENTS.md](../../../AGENTS.md)；跨语言规则只在 [公共代码质量](../common/code-quality.md) 维护，本端补 TypeScript、React、组件与 UI 差异。

## 任务路径

| 输入任务 | 入口与范围 |
|---|---|
| 无设计稿，按需求开发 | 普通前端实现；读相关业务、共同 UI 规则和真实 API，不先制稿、不造设计基线 |
| 已有 Figma/Pencil，指定页面实现 | 使用 `design-to-code`，读 [设计交付约定](../../design/design-handoff.md) 与共同规则；来源只读 |
| 明确要求制作或修改 Pencil 稿 | 使用 `pencil-design`，读 [设计入口](../../design/README.md) 与交付约定；按授权制稿 |
| 对指定设计和实现验收 | 使用 `design-qa`，固定设计/状态/适配并报告证据；不自动取得修复权 |

三个正式 Skill 与共同协议由同一 Skills 来源提供，来源、锁定快照与安装入口见 [Skill 来源与安装](../../design/design-handoff.md#skill-来源与安装)；工作流正文随来源更新，项目不另写执行规则。制稿、实现、公共库维护分别按任务范围授权；已有稿可以直接消费，不为交接重做原型。

## 按影响面读取

页面或交互任务共同读取相关 [产品需求](../../product/README.md)、[UI 规范](../../design/ui-spec.md)、[Token 政策](../../design/tokens.md) 与 [UI 状态](standards/accessibility-and-ui-states.md)；选择组件时读治理/清单相关项并核对源码。不默认加载全部规范、Token 或组件，文档/查询/局部逻辑任务按影响缩小读取。

| 任务 | 最小读取集 |
|---|---|
| 新增或修改前端代码 | [公共代码质量](../common/code-quality.md) + [前端编码](standards/frontend-development.md) |
| React 组件、Hook、请求或性能 | 追加 [React 规则](standards/react-patterns.md) |
| 复用或新增 UI | 先查 [组件清单](components/component-inventory.md)，再读 [治理](components/components.md) 与 [组件 API](standards/component-definition.md) |
| 拆分、移动、建立公开出口 | [治理与抽取](components/components.md#抽取方法)、[目录](standards/file-organization.md) |
| 加载、错误、表单、键盘、可访问性 | [UI 状态](standards/accessibility-and-ui-states.md) |
| Provider、Router、账户/模板边界 | [真实技术基线](architecture/technology-options.md)、[组件清单](components/component-inventory.md) |
| 主题、多语言 | [theme / i18n](guides/theming-and-i18n.md) |
| 视觉、Token 或设计适配 | [UI 规范](../../design/ui-spec.md)、[Token 政策](../../design/tokens.md)、[交付约定](../../design/design-handoff.md)；资产在 [设计入口](../../design/README.md#资产登记) |
| 代理、构建、配置 | [Vite 配置](guides/runtime-config-and-vite.md)，公共细节查 [运行约束](../common/README.md) |
| 架构、选型、分层 | [技术基线](architecture/technology-options.md) |
| 仅前端文档 | 目标文档及其直接引用；[文档检查范围](../common/README.md#验证范围)，不加载无关代码规范 |

同一任务已读文档不重复加载；API 任务补 [跨端契约](../../contracts/README.md)，跨端协作补 [交付流程](../workflow/delivery.md)。外部 skill 仅为参考，不覆盖本仓库版本、接口和公开模块边界。

当前组件 API 以真实源码导出为准，不在规范复制 props；安装与检查命令见 [前端 README](../../../frontend/README.md)。
