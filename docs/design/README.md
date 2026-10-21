# 跨端设计入口

设计按实际消费端归属：Web 的设计稿、视觉规范、Token 使用政策与设计交接在 [frontend/design](../../frontend/design/README.md)；微信小程序对应内容在 [miniprogram/design](../../miniprogram/design/README.md)。手机 Web 与微信小程序不是同一平台，不因共享品牌而共用布局、控件或宿主规则。

| 内容 | 唯一事实源 |
|---|---|
| Web 设计规范、资产与代码映射入口 | [Web 设计](../../frontend/design/README.md) |
| 微信小程序设计规范、资产与代码映射入口 | [小程序设计](../../miniprogram/design/README.md) |
| 跨端配色所有权与同步边界 | [共享配色政策](tokens.md) |
| 通用交付接口、主题表达与证据边界 | [设计交付约定](design-handoff.md) |
| 产品范围、系统架构和 API 契约 | [产品](../product/README.md)、[架构](../architecture/README.md)、[契约](../contracts/README.md) |
| 各端工程规范与任务路径 | [Web](../engineering/frontend/README.md#任务路径)、[小程序](../engineering/miniprogram/README.md#任务路径) |

本目录不保存端专属设计库或规范副本。新增客户端时在该客户端下建立实际需要的 `design/`，本页只登记入口；不为未来平台预建空目录。各端工程规范仍在 `docs/engineering/<端>/`，不随设计资产迁移。

通用动作由全局安装、同一来源的 `ui-ux-delivery`、`pencil-design`、`design-to-code`、`design-qa` 与 `DESIGN-WORKFLOW.md` 维护；[工具入口](../engineering/workflow/tooling.md#安装与唯一机制) 是 Skill 来源的唯一登记，不在各端复制 Skill、Manager 或 OpenSpec。

需求级设计记录与业务消费稿归受影响端的 `design/`，引用根产品需求；跨端需求分别定位两个客户端的设计来源，共用根 Plan / Change 和接受范围。一次性的执行过程与验证证据放在对应 PR/change，不把它们复制成长效规范或另一套任务状态。
