# 前端技术架构

## 技术基线

现有 package.json / pnpm-lock.yaml 包含 React 18、TypeScript、Vite、React Router、Axios、TanStack Query、Zustand、Radix UI、Lucide、i18next、GSAP 和 Vitest/Testing Library。样式采用 CSS Modules 与 CSS 变量。具体版本以依赖文件为准，源码迁入不代表已在本项目验证运行。

## 分层与依赖

```text
app → pages → widgets → features → entities → shared
```

上层可依赖下层；shared 不依赖业务模块。同层 slice 默认不互相依赖；跨模块访问通过公开出口，跨领域组合上移到页面或 widget。

| 层 | 职责 | 当前落点 |
|---|---|---|
| app | 装配、路由、providers、全局错误边界 | `src/app/` |
| pages | 路由参数、页面组合与页面私有状态 | `src/pages/`，真实路径以 routes.tsx 为准 |
| widgets | 页面复合区块 | app-header、app-shell |
| features | 用户动作和业务流程 | auth、research-launch、research-history、share 等 |
| entities | 领域类型、查询、DTO 转换和展示 | company-research、research、market |
| shared | 请求客户端、配置、基础 UI、样式、主题与翻译 | `src/shared/` |

具体文件放置与模块出口见[文件组织](../standards/file-organization.md)。现有历史目录不因文档整理而重排。

## 数据流

用户操作 → feature action / query / mutation → entity 或 feature 的 API/repository → shared 请求客户端 → 后端；响应经 DTO/mapper 进入领域模型和页面。

服务端状态归 TanStack Query；客户端 store 只持有必要的跨组件 UI 状态；表单草稿和展开项优先局部状态。页面不直接创建客户端或重复维护服务端事实。

新接入保留现有客户端和组件，替换旧 API/DTO/事件边界，合同以[执行设计](../../../../docs/design/AI-Agent通用模板_技术设计与实现规范_v1.1.md)为准。旧代码中的任务类型和路径不要求新后端兼容。
