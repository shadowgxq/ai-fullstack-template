# CompanyLens 前端

从既有 `ai-berkshire/frontend` 复制，复用样式、组件、主题、多语言和交互。当前源码仍含旧服务 API；新后端按 CompanyLens Run 合同实现，接口适配尚未完成。

- [项目文档](../docs/README.md)：当前产品需求、系统架构与状态。
- [前端规范](docs/frontend/README.md)：分层、组件、编码和配置。
- [接口接入说明](docs/api/README.md)：新合同入口与旧接口参考。
- [运行配置](docs/frontend/guides/runtime-config-and-vite.md)：API/mock、开发代理和容器配置。
- [命令表](../docs/engineering/commands.md)：安装、开发及验证脚本与前置条件。

实际路由由 [routes.tsx](src/app/router/routes.tsx) 定义，包含研究、历史、报告和账号相关页面。存在页面不表示新研究服务或全部产品模式已实现。

Node/pnpm 要求以 package.json 为准，依赖使用原 pnpm-lock.yaml。启动前核对数据源和代理目标；默认配置仍指向旧 Railway 服务。

复制的 Manager/OpenSpec/repair 脚本保留在源码树中，当前项目任务统一在根 `docs/changes/` 维护，没有启用这些上游流程。
