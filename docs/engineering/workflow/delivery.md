# 全栈交付流程

流程机制由全局安装的 `MANAGER-WORKFLOW.md` 及对应 Skill 维护，读取入口见 [工具入口](tooling.md#安装与唯一机制)；本页只维护本项目的事实源、跨端边界和交付约束。

## 流程概览

已确认 PRD → 适用的 UI/UX 设计交付 → 正式技术方案 → OpenSpec 规划 → 按 Change/task 实现 → 还原验证与人工产品验收 → 按授权归档。

新业务涉及新页面、布局/导航或关键交互变化时，默认由 `ui-ux-delivery → pencil-design` 在正式技术方案前完成当前确认范围的设计；已有适用稿复用，无 UI 影响或轻量修改按全局 `DESIGN-WORKFLOW.md` 的执行范围跳过完整制稿。具体任务入口按目标包选择 [Web 前端](../frontend/README.md#任务路径) 或 [小程序](../miniprogram/README.md#任务路径)，项目交接要求见 [设计交付约定](../../design/design-handoff.md#交接与读取)。技术方案与规划引用同一设计来源，执行时 UI 任务使用 `design-to-code`；设计接受、代码验证与最终产品验收分别记录。

## 项目级事实源

`docs/product` 保存真实业务与验收；`docs/architecture` 保存稳定边界与需求对应的总/专项技术设计；`docs/contracts` 保存跨端语义，schema 由提供方生成。`manager/plan.yaml` 保存 requirement、集中 inputs、change 依赖与批次；详细任务只在活动 change 的 tasks。不要重复生成另一套 PRD、接口或任务状态。

采用当前 Manager 的 auto/full/rolling 规划策略；规划深度、制品生成时机和执行授权分别判断。明确范围可一次规划多个里程碑，只在执行对应 change 时生成详细制品；full 不授予跨批次执行权。受控修订处理变化，不每批重建全局计划。

标准/高风险变更应有真实内容批准；新 UI 以已确认代表性基线为准。局部小修使用已有 repair 队列；同一工作不同时进入两套状态机。纯模板同步/文档/工具维护可以在 PR 中记录范围、来源、影响面与验证，不伪装成产品需求或空业务制品。

## 一个需求，一个跨端交付单元

Change 按可独立验收的意图划分，Web/小程序/后端/测试通常是内部任务；只实现需求明确涉及的客户端，不因仓库中存在两端就生成双端 UI。契约与迁移先确定；之后仅在代码路径、DB、端口、缓存等共享资源无冲突时并行。保留 Change 与阶段两层依赖，不建立额外任务图。

执行者通过根 AGENTS 和受影响端导航读取规则；PRD、技术/UI 基线与共享输入按当前 Plan 格式引用，不把规范目录和整仓库登记成 Input。协调会话可将独立实现交给原生通用 subagent 并行处理，交接明确读写范围与验证授权，核对结果后单写 plan/tasks。默认由一个独立只读 Reviewer 审查实际 diff 与证据，用户明确 review=off 时可省略；实现者不审查自己的工作。每个 Change 检查与所需审查完成后及时回写 code-verified，阶段末再补必要集成检查。

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
| 完成/失败 | 当前 tasks、验证报告与 progress，不复制业务正文 |

代码、契约与评审/运行证据对应同一快照；UI 验证不能只看类型或截图存在。Code 缺陷不以改 Spec 消除；需求/设计改变先影响分析并按最新 Skill 失效批准/证据。自动 checkpoint 不是人类产品验收；manual/规划边界/预算/无进展遵循有限会话停点，不能自行重开解除限制。

## 最小上下文包

根 AGENTS → 受影响端导航 → 本次 Skill → 当前 change/repair → 相关产品/技术/契约章节与真实代码。只补任务所需公共代码质量、Python、React、事务或恢复规则；不加载完整历史。交接记录目标、版本、授权范围、直接消费者、资源与必要验收。

## 历史与发布

真实 OpenSpec archive、PR 合并、生产发布分别授权。机制见 [显式归档与剪枝](tooling.md#显式归档与剪枝)；旧归档不可普通修复重写，缺少真实完成结果不能冒充依赖满足。
