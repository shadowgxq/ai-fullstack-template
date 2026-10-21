# miniprogram 协作入口

公共约束继承 [根 AGENTS.md](../AGENTS.md)，本文件只维护小程序任务导航。

- 修改本端前先读 [专项导航](../docs/engineering/miniprogram/README.md)，按任务读取工程、设计与契约，不默认加载 Web 专项规则。
- 本端设计稿、视觉规范、Token 架构和设计交接由 [design/](design/README.md) 拥有；共享配色与通用交付接口只引用根事实源。
- 新增业务 UI 沿用全局设计 Skill 与根交付流程；平台为微信小程序，不把手机 Web 稿当成小程序已批准稿。
- 产品需求、系统技术方案、Plan、OpenSpec 和任务验证证据均归根目录；工程规范保留在根 `docs/engineering/miniprogram/`，不创建本端 docs / manager / openspec / 通用 Skill 副本。`design/` 是本端设计事实源，不是公共文档副本。
- 安装、监听编译、构建与检查见 [README](README.md)；只验证受影响范围，不默认打开开发者工具或运行浏览器。
