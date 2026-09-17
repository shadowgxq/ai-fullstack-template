# Python Development

适用于 `backend/app/`。运行与依赖版本见 [技术基线](../architecture/technology-baseline.md)，公共安全与协作约束不在此重复。

## 类型、数据与命名

函数、模块、变量使用 snake_case；类使用 PascalCase，常量使用 UPPER_SNAKE_CASE。公开函数标注参数和返回类型，名称表达业务含义，不使用裸 Any 掩盖边界。

请求、响应使用各自 Pydantic v2 schema，字段 snake_case。通用响应复用 `schemas/response.py` 的 ApiResponse，保留现有 Generic/TypeVar 写法，不引入与包最低 Python 声明不兼容的语法。

SQLAlchemy 使用 Mapped/mapped_column，查询放 repositories，可空列、唯一约束与索引明确。不要在 API 或 service 直接查 ORM，不拼接不可信 SQL。

## IO、异常与依赖

业务路由、service、repository 沿用同步 def；Session 经 Depends 注入，不在请求里新建 engine。写操作由 `transaction(db)` 收口 commit/rollback。`/ready` 是只读基础设施探针，不遵循业务 DTO 包装，不执行迁移。

业务失败抛 BusinessException 子类，由注册的 handler 统一返回。只捕获可处理的具体异常，不吞异常、不在 service/repository 中返回错误字典。日志使用已有 logger，避免敏感值。

绝对导入 `from app...`，依赖只向下：api→services→repositories→models。新依赖先评审必要性，再修改 pyproject 与 lockfile。配置统一走 `core/config.Settings`；环境变量与密钥要求见 [公共约束](../../common/README.md)。

## 验证

`make lint` 只执行 ruff check；`make check` 执行只读静态检查、格式检查和 pytest；`make format` 才会自动修复。完整命令见 [后端 README](../../../../backend/README.md)，不要在其他规范再定义不同语义。

业务分支修改补相邻回归，公共基础设施变更运行完整检查。表结构变化生成并审查 Alembic 迁移，然后在测试库升级。新增模型同时检查 Alembic 和测试 metadata 注册。

现有单测使用 SQLite/FakeRedis；真实 PostgreSQL/Redis 启动与认证由根 Compose smoke 验证，两者不能互相替代。跨端契约变更还需导出 schema、校验漂移及直接消费者。
