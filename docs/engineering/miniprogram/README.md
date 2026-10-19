# 小程序专项导航

目标包 `miniprogram/`，目标平台微信小程序。继承 [根协作入口](../../../AGENTS.md) 与 [公共代码质量](../common/code-quality.md)，只补 React/Taro 的平台差异。业务事实源、批准与进度仍见 [交付流程](../workflow/delivery.md)，通用 Skill 来源与读取路径见 [工具入口](../workflow/tooling.md)。

## 任务路径

| 任务 | 最小读取入口 |
|---|---|
| 工程初始化、选型或依赖 | [技术基线](architecture/technology-options.md)、[服务 README](../../../miniprogram/README.md) |
| 新业务页面、导航或关键交互 | 已确认 PRD → 全局 `ui-ux-delivery → pencil-design`；先读 [移动 UI](../../design/mobile/ui-spec.md)、[移动 Token](../../design/mobile/tokens.md) 与 [设计交付](../../design/design-handoff.md) |
| 已有适用设计的实现 | 全局 `design-to-code`；核对平台、宿主、状态与接受范围，读 [开发规范](standards/development.md) 和 [组件清单](components/component-inventory.md) |
| 小型样式/文案修复 | 复用现有组件及有效基线；不自动新建整套设计或跨端重构 |
| API、身份、文件或生命周期 | [开发规范](standards/development.md)、[跨端契约](../../contracts/README.md)、相关提供方 schema |
| 主题、适配与公共几何 | [移动 Token](../../design/mobile/tokens.md)、[移动 UI](../../design/mobile/ui-spec.md)；颜色修改追加 Web Token 的来源关系 |
| 验证/设计验收 | [运行验收](guides/runtime-and-verification.md)，UI 验收使用全局 `design-qa`；未运行部分如实记录 |
| 仅文档 | 目标章节与直接引用，不加载全部组件、规范和业务历史 |

Web 的 Radix、DOM、Tailwind、React Router 与桌面布局规则不自动成为本端约束；公共命名与正确性仍继承 common。共享输入按当前 Manager 格式引用相关章节，不把整个规范目录登记为 Input。一个跨端需求仍是一个 Change 内的多端任务，协调会话统一回写任务与进度。
