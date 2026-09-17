# 架构决策

accepted 表示决定已确认，proposed 表示待采纳；二者均不代表实现或验证完成。实现状态见[项目状态](../../project-status.md)。

| 决策 | 状态 | 范围 |
|---|---|---|
| [0001 单仓库与应用边界](0001-monorepo-and-stack.md) | accepted | 两个应用目录、一个 Python 包 |
| [0002 前端复用](0002-preserve-frontend.md) | accepted | 保留视觉交互，替换研究接入合同 |
| [0003 进程与存储](0003-processes-and-storage.md) | proposed | 同包 API/Worker、单机共享卷；应用目录边界已确认 |
| [0004 台账与 checkpoint](0004-ledger-and-checkpoint.md) | proposed | 执行恢复与外部交换账务分工 |
| [0005 API 与事件](0005-api-events-contract.md) | proposed | 公开 DTO、快照与持久事件 |
| [0006 不可变交付](0006-immutable-delivery.md) | proposed | Candidate、Audit、Delivery 与发布门禁 |

决定变更时新增或更新记录并明确承接关系，不删除历史取舍。
