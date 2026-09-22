# 前端专项导航

`src/` 指 `frontend/src/`。公共协作约束继承 [根 AGENTS.md](../../../AGENTS.md)；跨语言规则只在 [公共代码质量](../common/code-quality.md) 维护，本端补 TypeScript、React、组件与 UI 差异。

| 任务 | 最小读取集 |
|---|---|
| 新增或修改前端代码 | [公共代码质量](../common/code-quality.md) + [前端编码](standards/frontend-development.md) |
| React 组件、Hook、请求或性能 | 追加 [React 规则](standards/react-patterns.md) |
| 复用或新增 UI | 先查 [组件清单](components/component-inventory.md)，再读 [治理](components/components.md) 与 [组件 API](standards/component-definition.md) |
| 拆分、移动、建立公开出口 | [拆分](components/component-splitting.md)、[目录](standards/file-organization.md) |
| 加载、错误、表单、键盘、可访问性 | [UI 状态](standards/accessibility-and-ui-states.md) |
| 主题、多语言 | [theme / i18n](guides/theming-and-i18n.md) |
| 代理、构建、配置 | [Vite 配置](guides/runtime-config-and-vite.md)，公共细节查 [运行约束](../common/README.md) |
| 架构、选型、分层 | [技术基线](architecture/technology-options.md) |
| 仅前端文档 | 目标文档及其直接引用；[文档检查范围](../common/README.md#验证范围)，不加载无关代码规范 |

同一任务已读文档不重复加载；API 任务补 [跨端契约](../../contracts/README.md)，跨端协作补 [交付流程](../workflow/delivery.md)。外部 skill 仅为参考，不覆盖本仓库版本、接口和公开模块边界。

当前组件 API 以真实源码导出为准，不在规范复制 props；安装与检查命令见 [前端 README](../../../frontend/README.md)。
