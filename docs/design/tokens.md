# 共享配色政策

本页只维护跨端配色的所有权与同步边界。Web 的 Token 选择、字体和几何规则见 [Web Token](../../frontend/design/tokens.md)；微信小程序的尺寸、三层别名和原生主题映射见 [小程序 Token](../../miniprogram/design/tokens.md)。两端不复制彼此的视觉规范。

## 唯一值源

现有共享 Light / Dark 品牌与状态色值继续由 [frontend/src/shared/styles/global.css](../../frontend/src/shared/styles/global.css) 维护。小程序通过 [sync-tokens.mjs](../../miniprogram/scripts/sync-tokens.mjs) 按白名单生成本端色板、原生主题和图标；不在根文档新增手写色值表或第二份 Token 数据源。

该共享关系不要求小程序运行时导入 Web CSS，也不共享 Web 字体、尺寸、布局和组件实现。移动几何由 [tokens.scss](../../miniprogram/src/shared/styles/tokens.scss) 拥有；生成细节和漂移检查归小程序 Token 文档。

## 变更边界

共享色值变更时核对两端直接消费者、两主题及相应设计表达，再同步小程序生成物；不能以搬迁文档为由改变生成方向、静默切断依赖或引入另一套色板。仅修改本端尺寸、交互或设计布局，不要求另一客户端同步改动。

设计库中的变量是设计表达，运行时值以对应源码为准。设计候选、静态预览与已发布 Token 分开登记；具体映射和接受范围由各端交接维护。需要独立品牌或平台中立值源时，作为明确的架构变更迁移所有者与消费者，不在普通设计任务中隐式实施。
