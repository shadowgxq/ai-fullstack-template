# Agent Guide

## 定位

本文档只补充 Agent 执行检查、验证交付和模板成熟度自检。协作硬规则看 `AGENTS.md`，文档入口看 `docs/README.md`，前端工程规范看 `docs/frontend/`，Manager/OpenSpec 看 `docs/ai/openspec-manager-flow.md`。

## 执行检查

- 先明确用户目标、影响范围、输入输出和限制条件；歧义影响结果时先确认。
- 只读取当前任务相关文档和源码：目标文件、相邻组件、shared UI、hook、API module、request client、状态 owner 和 `package.json`。
- UI 改动检查组件层级、复用入口、真实数据流、交互路径，以及 loading、empty、error、disabled、readonly、no access、focus、keyboard 等必要状态。
- 跨架构、依赖、路由、shared UI API、缓存、mutation 或全局状态时，先稳定方案，再最小范围修改。
- 涉及业务规则、接口契约或验收标准时，读取使用方项目的 `docs/prd/`、`docs/api/` 或 `openspec/specs/`，不要写回通用模板文档。
- 涉及 Manager/OpenSpec 时，读取 `manager/plan.yaml`、`docs/ai/openspec-manager-flow.md` 和用户级全局 `manager-*` skills（如 `~/.claude/skills/manager-*`，含捆绑的 `plan_tool.py` 状态机脚本）。

## 验证与交付

具体命令以使用方项目 `package.json` 和项目文档为准。按改动类型选择最小必要验证：

| 改动类型                         | 推荐验证                         | 关注点                                  |
| -------------------------------- | -------------------------------- | --------------------------------------- |
| TypeScript 类型、hook、API model | typecheck                        | 类型边界、泛型、返回值、空值            |
| 组件结构或 JSX                   | lint + typecheck                 | hook 规则、未使用变量、props 契约       |
| CSS Modules、token、响应式样式   | lint + 人工检查                  | 溢出、断点、状态样式、token 使用        |
| shared UI                        | 至少两个使用场景检查             | API 兼容性、默认行为、状态覆盖          |
| 数据流、query、mutation          | loading/error/empty/pending 检查 | cache、乐观更新、错误反馈               |
| 路由、权限、只读态               | 路由状态检查                     | no access、readonly、redirect、fallback |

交付时说明修改范围、关键取舍、已执行验证、未执行验证及原因、替代检查和剩余风险。

## 模板成熟度自检

模板新增可复用能力或迁入新项目后，用以下清单检查是否仍保持可复用、可迁移、可被 Agent 执行。

- `AGENTS.md`、`README.md` 和 `docs/README.md` 能说明协作规则、模板用途、文档分类、业务边界和维护规则。
- `docs/ai/` 覆盖目录入口、Agent 执行补充、Manager/OpenSpec 流程和模板成熟度自检。
- `manager/`、用户级全局 `manager-*` skills、`scripts/manager/` 和 `scripts/ralph/` 提供计划、执行、归档和自动循环入口。
- `docs/frontend/` 覆盖技术基线、组件、文件组织、UI 状态、可访问性、组件清单和新项目落地步骤。
- `openspec/`、基础 Vite 配置和 `src/` 能支持新项目落地、规范复用和最小运行。
- 文档示例保持业务中性，不包含具体产品、行业、权限、接口、页面需求或验收标准。
- `src` 只包含通用入口和业务中性示例，`shared` 只承载跨业务复用能力。
- 使用方项目需要补充的业务文档、API contract、验证命令和项目专属约束已明确列出。
- 推荐技术栈和强制依赖边界清晰。
- 安装依赖后可通过项目声明的 `dev`、`build` 和 `typecheck` 类命令验证基础工程。

不成熟信号：

通用模板文档混入具体业务、协作规则缺少可执行边界、目录结构缺少职责说明、组件规范缺少状态和抽象边界、质量门禁不按改动类型区分，或把推荐技术栈写成不可替换的强依赖。
