# 全栈交付流程

流程机制唯一来源为已固定的 [Manager 工作流](../../../.agents/skills/MANAGER-WORKFLOW.md) 及对应 Skill；本页只维护本项目的事实源、跨端边界和交付约束。

## 项目级事实源

`docs/product` 保存真实业务与验收；`docs/architecture` 保存稳定边界与需求对应的总/专项技术设计；`docs/contracts` 保存跨端语义，schema 由提供方生成。`manager/plan.yaml` 保存 requirement、集中 inputs、change 依赖与批次；详细任务只在活动 change 的 tasks。不要重复生成另一套 PRD、接口或任务状态。

采用上游 auto/full/rolling 规划策略；规划深度、制品生成时机和执行授权分别判断。明确范围可一次规划多个里程碑，只在执行对应 change 时生成详细制品；full 不授予跨批次执行权。受控修订处理变化，不每批重建全局计划。

标准/高风险变更应有真实内容批准；新 UI 以已确认代表性基线为准。局部小修使用已有 repair 队列；同一工作不同时进入两套状态机。纯模板同步/文档/工具维护可以在 PR 中记录范围、来源、影响面与验证，不伪装成产品需求或空业务制品。

## 一个需求，一个跨端交付单元

Change 按可独立验收的意图划分，前端/后端/测试通常是内部任务。契约与迁移先确定；之后仅在代码路径、DB、端口、缓存和浏览器资源无冲突时并行。change 间 waves 与 change 内 execution DAG 分开。

角色通过根 AGENTS 和受影响端导航读取规则；PRD、技术/UI 基线走专用字段，真正共享输入定义一次并以 input_refs 引用，不把规范目录和整仓库都登记成 Input。Worker 返回修改、结果与证据；Manager 核对后单写 plan/tasks。真实线程未停止不能抢占任务。

## 验证与同步

本项目检查入口与角色见 [工具入口](tooling.md)。先保存已完成代码的远端 checkpoint，再按授权范围验收；失败追加修复到同一 PR，不将“已提交”写成“已通过”。环境失败记录 failed/blocked/not run，继续不依赖它的验证；真正缺批准、范围或关键依赖时不冒充已完成、也不自动扩大权限。

| 变化 | 同 PR 必须更新 |
|---|---|
| 用户行为/验收 | product、change specs/tasks 与回归 |
| 技术边界/选型 | architecture、相关配置与 README |
| API/DTO/错误 | 提供方 schema、生成契约、直接消费者与测试 |
| 表结构/Checkpoint | 迁移、兼容说明、真实 PostgreSQL 验证 |
| 组件/Provider/Router/Theme | 源码、前端清单及对应专项指南；不复制 props/全部 token 值 |
| 环境与命令 | env 示例、README、Compose/CI |
| 完成/失败 | 当前 tasks 与真实 runtime 证据，不复制业务正文 |

代码、契约与评审/运行证据对应同一快照；UI 验证不能只看类型或截图存在。Code 缺陷不以改 Spec 消除；需求/设计改变先影响分析并按最新 Skill 失效批准/证据。自动 checkpoint 不是人类产品验收；manual/规划边界/预算/无进展遵循有限会话停点，不能自行重开解除限制。

## 最小上下文包

根 AGENTS → 受影响端导航 → 本次 Skill → 当前 change/repair → 相关产品/技术/契约章节与真实代码。只补任务所需公共代码质量、Python、React、事务或恢复规则；不加载完整历史。交接记录目标、版本、授权范围、直接消费者、资源与必要验收。

## 历史与发布

真实 OpenSpec archive、PR 合并、生产发布分别授权。机制见 [显式归档与剪枝](tooling.md#显式归档与剪枝)；旧归档不可普通修复重写，完成凭证缺失不能冒充依赖满足。
