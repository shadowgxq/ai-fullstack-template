# 后端 Python 实现入口

后端代码读取 [公共代码质量](../../common/code-quality.md)、[Python 公共写法](../../common/python.md) 与本页；已读公共内容不重复加载。本页只补 `backend/app/` 的特有约束。

## 当前实现落点

| 关注点 | 规则与现有入口 |
|---|---|
| HTTP 与业务边界 | 同步 FastAPI；`app/api/dependencies.py` 装配依赖，路由调用 service；细则见 [分层](layer-definition.md) |
| 数据访问 | SQLAlchemy `Mapped/mapped_column`、同步 Session/psycopg2；查询和写入只进 repository |
| 写事务 | Service 使用 `transaction(db)`；repository 不 commit/rollback；并发冲突在回滚后转换 |
| DTO 与错误 | Pydantic 请求/响应分型；复用 `schemas/response.py` 和 BusinessException；细则见 [API 契约](api-and-error-contract.md) |
| 配置与缓存 | `core/config.Settings`、`core/session`、`core/redis_client` 单一入口；安全依赖与缓存分开处理，见 [基础设施](infrastructure.md) |

绝对导入使用 `from app...`；业务模块不直接 import AI 服务，不将具体业务塞进 `core`。新文件落点见 [目录规则](file-organization.md)，版本与工具链见 [技术基线](../architecture/technology-baseline.md)。

## 验证重点

按 [后端 README](../../../../backend/README.md) 执行受影响静态检查和相邻测试；公共基础设施或影响面无法收窄时再扩大到本端完整检查，不在本文重定义命令。

Service 规则关注非法输入、资源权限、事务失败与并发唯一冲突；API 关注真实状态码、安全错误和 response model；repository 关注查询约束与存取。测试不得 mock 掉本次要验证的规则或提交边界。

表结构变化检查模型在 Alembic/test metadata 的注册，生成并审查迁移，再在测试库升级。SQLite/FakeRedis 只证明其覆盖的逻辑；PostgreSQL/Redis 特有行为需要真实依赖验证，不能互相替代。共享契约变化补 [提供方导出与直接消费者](../../../contracts/README.md)，不能只验证后端类型。
