# 架构实施规划输入

当前任务仍使用 `docs/changes/<change-id>/spec.md`。本文保留可选 Manager/OpenSpec 交接；尚未生成 `manager/plan.yaml` 或启用该流程。若后续明确采用，活动任务只在选定体系维护，旧 D0 任务注明承接关系，不双写状态。

系统架构的 SYS-* 与 AC-* 是需求和验收编号；[机器索引](../references/requirement-index.json)只用于导航，不记录实施完成度。规划读取完整架构和适用设计，按可独立验收的行为拆分，不按章节、表或文件机械拆任务。P1–P3 仍是后续范围。

## 1. 主来源和输入边界

**本节明确将下表三份文件交给 Manager/OpenSpec 的设计编写、实现和验证消费者使用。** 路径为仓库相对路径；Markdown链接用于阅读，`source`列用于plan引用。不存在的路径必须在预览前解决，不能靠文件名猜位置。

[系统技术架构](../architecture/ai-architecture.md)是主需求来源，放入`requirements[].source`；不因详细设计链接回来而再添加为`inputs`。系统技术架构第10.1节ADR和附录D方法链接是决策/来源追溯，**本节未把它们声明为额外执行输入**。项目实际有其他必需设计资产时，由用户或明确交接声明追加，不能自行扫描参考链接变成工作范围。

| input_id / kind | source / 可读链接 | required | 明确消费者 | 每个相关消费者必读的共享范围 |
|---|---|---|---|---|
| `core-runtime-design` / `runtime-design` | `docs/design/AI-Agent通用模板_技术设计与实现规范_v1.1.md`：[打开](../design/AI-Agent通用模板_技术设计与实现规范_v1.1.md) | true | 引入/修改Run、外部调用、恢复、预算、事件或Run API的change | `heading:1. 实现目标、工程边界与首期剖面`；`heading:3. 技术选型与依赖方向`；`heading:5. 公共数据契约` |
| `research-domain-design` / `domain-design` | `docs/design/AI公司研究_业务架构与接入设计_v1.1.md`：[打开](../design/AI公司研究_业务架构与接入设计_v1.1.md) | true | 取证/核验/计算/研究报告/研究展示的change | `heading:1. 需求依据与产品边界`；`heading:3. 输入、模式、服务接入与小状态` |
| `system-integration-detail` / `system-contract` | `docs/design/system-integration-details.md`：[打开](../design/system-integration-details.md) | true | 当前所有系统实现与集成验证change | `heading:0. 共享合同与适用性` |

三份文件分别计入显式input ledger，不能因为它们互相有链接就只登记父文件。它们作为支持输入提供设计细节，不把未来标准/团队/专项升级成当前新增产品需求。

## 2. 按消费者补充读取范围

下表列的是**真实存在于对应文件的标题locator**。每次scope必须同时包含第1节的共享范围及所有适用行；一个change跨多个职责时取并集。表只是读范围，不是预设change拆分。

| 消费内容 | 输入 | 追加scope |
|---|---|---|
| Run、命令、回答、取消、版本 | core-runtime-design | `heading:6. Runner 接口与状态转换`；`heading:7. 持久化、事务和恢复`；`heading:15. 应用宿主、HTTP 与前端接入合同` |
| 外部调用、权限、预算、上下文 | core-runtime-design | `heading:7. 持久化、事务和恢复`；`heading:8. 操作、重试与预算`；`heading:9. 模型、工具、Skill 和上下文接口` |
| 事件、观测、恢复验证 | core-runtime-design | `heading:10. 事件与 Langfuse`；`heading:12. 后续实现验收要求`；`heading:13. 跨版本评估与优化依据`；`heading:15. 应用宿主、HTTP 与前端接入合同` |
| 身份、证据、数字 | research-domain-design | `heading:4. 公司、证券、人物与三市场适配`；`heading:5. 时间、研究范围与信息丰富度`；`heading:6. 取证架构：发现、读取、抽取分别落地`；`heading:7. 数据核验与来源独立性`；`heading:8. 财务对象与确定性计算` |
| 固定图、报告准出、依赖失效 | research-domain-design | `heading:9. 标准工作流与 P0 可实现闭环`；`heading:13. 报告、审计与结果合同`；`heading:14. 修订、依赖失效与恢复`；`heading:15. 业务模块、方法资源与接入文件` |
| 上游迁移与研究资源 | research-domain-design | `heading:15. 业务模块、方法资源与接入文件`；`heading:18. ai-berkshire 源码抽离与 LangGraph 迁移方案` |
| 研究页面与发布验证 | research-domain-design | `heading:13. 报告、审计与结果合同`；`heading:16. 统一实施顺序与可验收的里程碑`；`heading:17. 开发前配置、未解决事项与上线门槛`；`heading:19. 业务页面、API 投影与研究可解释性` |
| 数据与恢复 | system-integration-detail | `heading:1. 应用数据与约束`；`heading:2. 事务与恢复协议` |
| HTTP、事件、前端 | system-integration-detail | `heading:3. HTTP 与 DTO 合同`；`heading:4. 事件与快照算法`；`heading:5. 前端迁移与访问控制` |
| 部署与验证 | system-integration-detail | `heading:6. 启动、存储与升级协议`；`heading:7. 故障注入与验收接缝` |

仅做某局部功能而引用系统技术架构第9节的某条需求时，仍需检查所有相关正文行为。未列入的源内规范若被该change实际使用，应增加真实定位；稳定scope不能覆盖完整适用内容时用整份输入，而不是丢掉剩余约束。

## 3. 版本与接入

原始包按 `shadowgxq/skills@f77052abde543d2d2365b3d18886951379193c93` 核对过规划接口，来源见[原始交接说明](../archive/source-packages/companylens-system-architecture-v1.0/MANAGER_HANDOFF.md)。实际采用时以所用 Skill 版本、用户授权和仓库现状为准，确认主来源、需求覆盖、输入范围、任务依赖与文件所有权后再写计划。本文不表示 Skill 已运行或计划已通过验证。
