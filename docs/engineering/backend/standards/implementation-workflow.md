# 后端实现顺序

只说明本端新增资源/接口的实施顺序；需求、跨端协作与进度统一遵循 [交付流程](../../workflow/delivery.md)。`app/` 指 `backend/app/`。

| 步骤 | 产出与完成判据 |
|---|---|
| 1. 契约 | 明确请求/响应、错误与授权；关联根需求及直接消费者，使用独立 Pydantic schema |
| 2. 持久化 | Model、索引和约束；生成、审查 Alembic 迁移；在测试库执行 upgrade |
| 3. 数据访问 | Repository 只负责查询/写入，不含业务规则 |
| 4. 业务编排 | Service 收口规则、权限与事务；核心分支有回归测试 |
| 5. 路由装配 | 使用依赖装配 service，在 main 注册；接口在 OpenAPI 可见且实际可达 |
| 6. 验证与同步 | 本端 `make check`；根 `make contracts` 与消费者回归；同步 tasks 证据 |

已有 users 初始迁移，首次安装只 upgrade，不重复生成。新增模型须检查 Alembic/test metadata 注册；业务错误复用 BusinessException，不能在 service 中绕过统一异常契约。Redis 故障策略要按安全边界评审，不能机械对所有新增认证操作 fail-open。

细则见 [分层](layer-definition.md)、[目录](file-organization.md)、[契约](api-and-error-contract.md)、[基础设施](infrastructure.md)、[Python](python-development.md)。
