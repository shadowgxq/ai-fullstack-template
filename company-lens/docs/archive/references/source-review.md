# 来源核对、迁移边界与快照

> 当前补充：已读取并复制用户指定的本地前端，详见 [前端迁入记录](../../references/frontend-import.md)。下文是原大纲生成时的来源核对历史，公开入口未获取的结论不代表当前仍缺少前端源码。

> 日期：2026-09-16。本文区分本轮实际读取、沿用前轮设计和本轮新增建议。

## 1. 本轮实际来源

| 来源 | 实际读取 / 处理 | 可以支持什么 | 不能支持什么 |
|---|---|---|---|
| 两份v1.1设计 | 读取工程、状态、API、业务页面、实施顺序等相关内容；附原样快照 | 既有设计边界与合同 | 产品已开发、真实服务已运行 |
| 原始公司研究模块材料 | 上下文提供全文，文件原样归档 | 标准/团队/专项原始要求 | 完整项目PRD、已确认所有新政策 |
| frontend-agent-template | 公开入口访问返回404；未取得源码 | 只能说明本次公开获取失败 | 仓库不存在、私有原因、实际目录/依赖、可直接迁移文件 |
| 用户此前ui-ux-delivery资料 | 从Library读取目标/边界、文件布局、门禁示例及前置读取段落 | UX/UI/实现分工、旧路径约定 | 已核实属于该Git仓库当前提交或脚本已支持本新布局 |
| 官方技术文档 | 本轮查阅AGENTS、Node/Vite、uv、OpenAPI工具、SQLAlchemy、PostgreSQL等 | 相应机制与候选选型 | 所有依赖组合已通过本项目测试 |

ui-ux-delivery资料的可识别信息：name=ui-ux-delivery，metadata.version=0.1.0，metadata.author=quick-web-service-hub；Library展示文件名为1073ec99-3eff-4b75-991d-d86ca35a43d5.md。这里只保留来源描述和使用边界，不复制未核验依赖脚本或宣称完成Skill安装。

学习仓库与ai-berkshire取舍沿用两份v1.1中已明确的核对范围；本轮未重新审核全部源码。

## 2. 前端模板获得访问后的核对清单

以下是**待查类别，不是声称源仓库已有这些文件**。

| 待核对内容 | 适合保留 | 本项目需要改造 | 准入证据 |
|---|---|---|---|
| README/AGENTS/规范入口 | 文档路由、工作程序、真实命令 | 统一指向仓库级PRD/设计，前后端分层规则 | 真实路径/commit/hash |
| package/lock与构建 | 已验证的React组件工具链 | 与本次建议对比，优先减少无必要迁移 | 安装与build结果、兼容记录 |
| token/theme/UI基础组件 | 本项目可采纳的稳定组件模式 | 视觉须本项目批准，不混原产品业务 | 组件行为/可访问验证 |
| API/状态封装 | HTTP错误、Query、请求取消等通用能力 | 改为后端生成契约，处理Run/研究质量分层 | 契约测试与错误用例 |
| UX/UI流程 | 行为/视觉门禁和工件记录 | 兼容实际Skill路径，不隐式改变project root | 路径测试、批准记录 |
| 测试/CI | lint、类型、组件、浏览器检查 | 增加Python、schema漂移与付费网络隔离 | CI真实运行证据 |
| 页面/Mock/旧服务调用 | 仅有当前需求支持的部分 | 删除不相关业务须有任务授权，不能整库盲删 | 需求对应与回归 |

迁移记录字段：source_repo、commit、source_path、content_hash、license、reuse_mode、target_path、removed_assumptions、tests、review_status。源码取得前保持not_reviewed，不填虚构commit。

## 3. 原样输入快照

下列文件仅为字节级复制，未修改正文。它们是当前文档包的依据，不表示其引用的外部系统已运行。

| 文件 | SHA-256 | 字节数 |
|---|---|---|
| `docs/product/sources/ai-berkshire 公司研究模块.md` | `061c7c6ec5fde0e3ba57b81893e70b1800d09033eab684a737d875d0e62a36ff` | 11092 |
| `docs/design/AI-Agent通用模板_技术设计与实现规范_v1.1.md` | `a7ff6aaf7f87a7521988cc9eb2d1e7c598e4f0d4f7f7951c69e361f0dc6921d2` | 72889 |
| `docs/design/AI公司研究_业务架构与接入设计_v1.1.md` | `1482b9ecab985a15bed217d5eae5f6ebafe80b848dfc974554c0ff6e41cffd1d` | 105738 |

## 4. 外部参考与本轮选择

完整官方参考链接集中在 [工程规范第20节](../../engineering/ai-development-standard.md)。Node24、PG17是推荐保守基线；React/Query/shadcn等属于本项目提案，不归因于未读取的模板。

本包没有对原始材料声明新的许可证。外部源码实质复制时保留许可；金融数据访问和正文再分发许可需要另外核对。
