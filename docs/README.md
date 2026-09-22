# 文档地图

先读 [根 AGENTS.md](../AGENTS.md)，再通过本页定位受影响端入口与事实源。首次编辑前只读取当前任务需要的规范，范围扩大时再补读。

## 规则归属

工程规范采用“公共原则 + 语言共性 + 各端差异”，不是把三端实现规则统一成一个框架：

```text
AGENTS.md                         公共协作约束与任务路由
  → engineering/common/           代码质量；按需 Python、数据与运行细节
  → engineering/<端>/README.md    选择本端编码、分层、组件或恢复细则
```

根与各端 `AGENTS.md` 保持短入口；正文只维护在对应规范文件。代码任务读取短公共基线和受影响端，不默认加载所有规范；文档任务只读目标及引用。已读规则不重复加载，读取入口继续使用下表，不要求逐级遍历目录。

跨端必须一致的命名语义、注释、复用和正确性放 common；React props、SQLAlchemy 事务、LangGraph 恢复保留各端。两 Python 服务共享语言规则，不共享 ORM/响应信封。安全约束与公开契约不能被专项规则放宽；格式以本端配置为准，技术用法以锁定版本和真实实现核对，冲突修正唯一事实源，不复制另一套规则。

| 唯一事实源 | 维护者 / 按需场景 |
|---|---|
| [根 AGENTS.md](../AGENTS.md) | 所有 Agent；沟通、改动范围、命令授权与文档路由 |
| [公共工程细则](engineering/common/README.md) | [代码质量](engineering/common/code-quality.md) 覆盖变量/注释/复用/准确性；[Python](engineering/common/python.md) 与数据/运行/验证按需补读 |
| [交付流程](engineering/workflow/delivery.md) | 工作分级、技术方案批准、垂直 change、有限执行与验收；[工具兼容](engineering/workflow/tooling.md) 区分当前能力与 Manager v2 接入条件 |
| [前端规范](engineering/frontend/README.md) | UI、状态、路由、工具链；入口为 [frontend/AGENTS.md](../frontend/AGENTS.md) |
| [后端规范](engineering/backend/README.md) | 认证、CRUD、迁移、Redis；入口为 [backend/AGENTS.md](../backend/AGENTS.md) |
| [AI 服务规范](engineering/ai-service/README.md) | 技术基线、分层、Workflow/State、恢复、模型/工具、API/产物与 Evals；入口为 [ai-service/AGENTS.md](../ai-service/AGENTS.md) |
| [产品需求](product/README.md) | 使用方的真实产品范围与验收；模板不预装业务 PRD |
| [架构与 ADR](architecture/README.md) | 系统基线及按需业务总/专项技术方案；批准内容由 change 引用，不复制成另一份 design |
| [跨端契约](contracts/README.md) | DTO、状态、错误语义；生成 schema 的事实源在提供方代码 |
| [当前计划](../manager/plan.yaml) | 已登记需求、批次与 change 阶段；模板初始为空 |
| [OpenSpec 配置](../openspec/config.yaml) | change 的设计、任务与增量规格 |
| [修复队列](../repairs/README.md) | 小范围修复；不同时建立另一份执行状态 |

## 文档维护规则

- 长期文档描述当前系统、明确的目标能力或可复用规则，写清适用范围、事实源和限制；不复制用户原话、AI 回复、临时执行提示词或单次交付总结。
- 产品需求只记录使用方真实业务。模板自身的初始化、迁移、清理和验证记录放在 PR/对应 change，不包装成产品 PRD；纯模板维护可以直接在 PR 记录范围与证据。
- 当前能力、未实现边界和重要 ADR 必须保留。决策依据与必要来源链接不是对话残留；生成契约仍由代码导出，不因文档清理手工改写。
- AGENTS 与 SKILL 可以包含职责范围内的执行指令；版本化运行时 prompt 放在对应资源目录。文档中的调用示例应明确标为示例并使用代码块，不作为真实任务或进度。
- 同一规则只在一个事实源维护，其他位置链接引用。语义重复优先合并，不通过新增总结、清理报告或规则副本制造更多长期文档。
- 模板发布保留入口、工具配置和空任务索引，不携带模板维护任务、旧业务 PRD 或历史验收报告。已有使用方项目仍按审计要求归档业务 change，不据此清空进行中的任务或业务规格。

## 维护与流转

新增、删除或移动文档时同步导航、相对链接、REQ-ID 和任务索引引用。命令在服务 README 与 Makefile 维护；schema 由提供方生成；版本以各端 lockfile 为准。

外部参考只提炼适用规则，在其规则拥有者处注明来源与适用边界；不复制完整社区 skill 或自动安装新工具。入口与细则分离借鉴 [Agent Skills 渐进加载](https://agentskills.io/specification#progressive-disclosure)，但工程文档仍由本仓库导航，不宣称新增或激活某个 skill。

使用方项目通过 [显式归档](engineering/workflow/tooling.md#显式归档与剪枝) 使用真实 OpenSpec 命令同步生效规格并封存 change；归档、合并和发布分别决定，不手工移动目录或改写旧归档。历史不作为默认任务上下文，剪枝前必须保留依赖可解析的完成证据。模板自身的维护来源与验证记录通过 Git/PR 历史追溯，删除工作树副本不改写历史。
