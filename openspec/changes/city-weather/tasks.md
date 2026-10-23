# Tasks

## 1. Backend 地区与天气事实

- [x] 1.1 Backend执行者在 `backend/app`、`backend/alembic/versions`、`backend/tests` 及必要Backend配置内实现冻结可信地区目录、可复核来源元数据/生成流程、搜索与城市profile版本保存；以真实来源字面量fixture、同名/重复/冲突/无效游标测试及本任务隔离PG旧head升级、数据保留、版本竞争和Alembic check验证，不改生成schema或Manager状态。
- [x] 1.2 Backend执行者在同一范围实现固定来源天气/可选地图适配、本人context及共享日缓存；验证事实地区/日期/时间、仅部分预报、坐标不持久化、owner/过期、外部HTTP无DB事务、天气缺失和认证fail-closed。使用冻结真实来源fixture与边界替身，不调用真实地图/微信/模型；返回稳定DTO和实际HTTP响应供协调者冻结契约。
- [x] 1.3 Backend执行者在任务所属55432 PG UUIDschema、56379 Redis DB14随机前缀内验证同城共享并发、失锁、跨午夜、7日EXPIREAT、短期负缓存与缓存故障；保留真实成功/失败证据并仅清理自己的资源，完成受影响Ruff/format/architecture/diff检查，不重复无关全库检查。

## 2. 小程序城市与天气

- [x] 2.1 客户端执行者使用 design-to-code，只读实际 NLCY6、fkIRs/XzsEz、P9tls/ZHXw9/QUgPr、递归组件和主题，完成当前任务prepare及390 Light/360 Dark来源导出；字体严格绑定按Plan例外pending。仅写 `miniprogram/src/features/weather/`、必要platform适配、业务设置入口及相邻测试/README，接通真实选城/主动模糊定位/版本保存/失败保留，以实际SDK类型、状态与事件测试和来源复读验证，不编辑Pen或生成schema。
- [x] 2.2 在Backend DTO冻结、协调者生成类型后，客户端执行者完成严格decoder、会话查询、可复用WeatherPanel和弹层；验证默认/保存城市、日期与源时间、观测/预报/缺失、搜索/定位/保存竞争、未知保存结果恢复、切号/退出迟到及关闭，不生成AI占位页面。执行受影响测试、typecheck、ESLint/Prettier、tokens及contracts检查，不启动浏览器或build。

## 3. 契约与收尾

- [x] 3.1 协调者从稳定提供方统一导出OpenAPI和客户端类型，以实际隔离PG/Redis HTTP data原样通过直接decoder验证搜索/选城/默认/缺失或可用事实；同步唯一契约与服务说明，核对必要M2相邻profile/会话消费者及diff，不以改写fixture适配错误实现。
- [x] 3.2 协调者安排独立只读Reviewer审查稳定Backend与客户端diff、契约及检查证据，必要修复定向复验复查；全部必要代码检查通过后回写本Change状态和报告，明确真实来源使用许可/地图配置/微信定位/字体绑定/视觉与产品人工待验，不自动归档或发布。
