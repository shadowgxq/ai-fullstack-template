# 架构决策

| 决策 | 状态 | 范围 |
|---|---|---|
| [0001 进程与存储](0001-processes-and-storage.md) | proposed | 同包 API/Worker、首期单 Worker 与共享持久存储 |
| [0002 台账与 checkpoint](0002-ledger-and-checkpoint.md) | proposed | 图恢复与外部交换账务分工 |
| [0003 API 与事件](0003-api-events-contract.md) | proposed | 公开 DTO、快照与持久事件 |
| [0004 不可变交付](0004-immutable-delivery.md) | proposed | Candidate、Audit、Delivery 与发布门禁 |

`proposed` 表示设计基线仍需在实现中验证。决定变化时更新状态或新增承接 ADR，并同步主架构。
