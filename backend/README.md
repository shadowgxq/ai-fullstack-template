# Backend

保留同步 FastAPI → service → repository → model 基座，SQLAlchemy 2、Alembic、PostgreSQL、Redis、JWT/bcrypt 认证。

Python 3.12、uv；先在仓库根执行 `make infra`，然后在本目录：

```bash
uv sync --locked
cp .env.example .env
make upgrade
make dev
```

已有初始 users 迁移，首次启动仅升级，不重复生成初始迁移。API 8000，OpenAPI `/docs`，存活 `/health`，依赖和表就绪 `/ready`。

```bash
make check                 # 只读 lint、format check、pytest
make format                # 显式格式修复
make migrate m="add field" # 新表结构才生成迁移，审查后 upgrade
make upgrade
```

环境变量：`DATABASE_URL`、`SECRET_KEY` 必填，`REDIS_URL` 默认本地；示例与根 Compose 的 backend 数据库一致。禁止使用 AI 数据库凭证。容器启动不执行迁移；根 Compose 单独运行 backend-migrate。

现有单测使用 SQLite/FakeRedis，不代表真实基础设施验证；根 `make up && make smoke` 验证 PostgreSQL 迁移、注册/登录、Redis token 撤销。可选缓存故障可回源；认证/限流/撤销依赖故障返回 503，不能伪报登出成功。开发基座仍不等于完整生产安全方案。

细则见 [专项导航](../docs/engineering/backend/README.md)，业务与跨端契约统一在根 docs。
