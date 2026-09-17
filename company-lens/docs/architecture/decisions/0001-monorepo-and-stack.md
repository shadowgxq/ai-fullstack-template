# ADR-0001：单仓库与应用边界

> 状态：accepted（工程边界已确认；不表示后端已实现）。

## 背景与决定

前端和 AI 服务需共享版本化接口并组成同一研究交付链。采用 `frontend/` + `ai-service/` 单仓库；API 与 Worker 来自同一个 `ai_service` 包，core/research 为内部模块。

## 原因与代价

统一仓库便于同时修改服务合同与前端消费者，避免维护多个 Python 工程。前后端各自管理依赖与锁文件，变更仍按应用边界验证。

## 相关决定

前端复用细节由 [ADR-0002](0002-preserve-frontend.md)维护；进程、数据库与部署建议由 [ADR-0003](0003-processes-and-storage.md)维护。原混合记录保存在[历史版本](../../archive/architecture/0001-monorepo-and-stack-before-system-v1.0.md)，其中未实施的选型仍为 proposed。

出现第二个真实业务或明确的独立发布需求时再评估拆仓或拆包。
