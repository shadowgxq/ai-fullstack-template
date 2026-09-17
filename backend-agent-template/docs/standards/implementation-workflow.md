# Implementation Workflow

新增资源域 / 新增接口从开始到交付的步骤清单与完成判据（步骤 owner）。适用范围：`app/`。
每步怎么写以链接的 owner 文件为准，本文只定顺序和完成判据，不复制细则。

## 适用场景

- **新增资源域**（新表 + 新接口）：按下表 1→6 全走。
- **扩展既有域**（加接口 / 加字段）：从受影响的最上游步骤进入，向下走完剩余步骤，完成判据同样逐项检查。

## 步骤清单（contract-first：先定契约再实现）

| # | 步骤 | 产出物 | 完成判据 |
|---|---|---|---|
| 1 | 定契约 | `schemas/<域>.py`（`Request`/`Response` 分型，Pydantic `BaseModel`，snake_case） | 出入参字段清晰，出参用 `ApiResponse[T]` 包裹 |
| 2 | 定表 | `models/<域>.py` + Alembic 迁移，并在 `alembic/env.py` 追加该模型 import | `make migrate` 生成迁移且 `make upgrade` 通过；可筛字段有列 + 索引 |
| 3 | 数据访问 | `repositories/<域>_repository.py`（`class XxxRepository(db)`） | 只有查询 / 写入，无业务规则 |
| 4 | 业务编排 | `services/<域>_service.py`（类 + 构造注入仓储；Redis 能力放 `*_redis_service` / `cache_service`） | 规则收口在此；写操作用 `transaction(db)`；核心规则有 pytest 覆盖 |
| 5 | 路由 | `api/v1/<域>.py`（工厂依赖装配 service），在 `main.py` 注册 `include_router` | `/docs` 能看到新接口，且实际可达 |
| 6 | 验证 | — | `make lint` + `make test` 全过；表结构改动已 `make upgrade` |

细则 owner：各层写法与跨层边界见 [layer-definition.md](./layer-definition.md)；文件命名与放置见 [file-organization.md](./file-organization.md)；响应 / 异常 / 鉴权见 [api-and-error-contract.md](./api-and-error-contract.md)；配置 / 事务 / Redis / JWT / 中间件见 [infrastructure.md](./infrastructure.md)；编码与验证命令见 [python-development.md](./python-development.md)。

## 常见漏项（交付前自查）

- 改了 `models/` 没生成 Alembic 迁移，或迁移没 `make upgrade` 验证；新模型忘了在 `alembic/env.py` / `tests/conftest.py` import，导致建表 / 迁移遗漏。
- 新建路由文件忘了在 `main.py`（或 `api/v1/__init__.py`）注册，接口实际不可达。
- 在 service / repository 里裸抛 `HTTPException` 或返回错误字典，未走 `BusinessException`。
- 写操作没用 `transaction(db)`，commit / rollback 边界散乱。
- 新增 Redis 操作没包 `redis_safe`，故障时把主流程一起拖挂。
- service 的核心规则（限流、黑名单、权限判断）没有 pytest，只验证了 happy path。
