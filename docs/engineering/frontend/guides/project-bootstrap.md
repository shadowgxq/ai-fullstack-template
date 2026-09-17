# 前端初始化与迁入

本仓库的运行目录是 `frontend/`，工程与产品文档统一在根 `docs/`。启动命令只维护在 [前端 README](../../../../frontend/README.md)。

## 基于模板创建产品

1. 修改项目名称与说明，保留 pnpm 锁文件和已验证的启动基座。
2. 在根 `docs/product/` 定义需求与验收，关联架构、契约及根 Manager/OpenSpec，不在前端另建台账。
3. 按现有 `frontend/src/` 分层追加页面、状态和数据流；默认保留 theme、i18n 和错误边界。
4. 根 AGENTS 只放公共规则与导航，前端 AGENTS 只放本端导航；具体约束进入 [专项文档](../README.md)，命令进入 README/Makefile。
5. 按 [全栈交付流程](../../workflow/delivery.md) 验证直接消费者、更新契约和任务证据。

初始化应确认依赖锁可安装、`pnpm check` 与 `pnpm build` 通过、环境示例与配置校验一致，且 `VITE_*` 不包含密钥。真实启动由根 Compose 与 smoke 验证。

## 已有项目迁入

先检查既有文件、业务需求和工作区改动，只迁入缺失且适用的能力。目录冲突先记录和评审，不覆盖原业务实现；不要直接复制第二套 docs、manager 或 openspec。

替换路由、请求、状态、UI primitive 时，同步实现、直接消费者、测试和对应技术基线。theme/i18n 的移除需要明确需求，并按 [专项指南](theming-and-i18n.md) 清理，不因本次整合擅自删除。
