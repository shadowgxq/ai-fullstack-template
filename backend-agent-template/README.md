# Backend Agent Template

FastAPI 后端模板项目。抽离自实践项目的可复用基础设施，开箱带一套完整的用户认证，新项目只需在既有分层上追加业务模块即可。

## 内置能力

- **分层架构**：`api → service → repository → model`，职责清晰，便于扩展与测试。
- **数据库**：SQLAlchemy 2.0（`Mapped`/`mapped_column`）+ Alembic 迁移；`transaction()` 上下文统一事务边界。
- **Redis**：`redis_safe` 降级装饰器（故障时自动降级不阻断主流程）+ 通用 JSON 缓存服务。
- **JWT 认证**：注册 / 登录 / 登出，`get_current_user` 依赖；含 Redis 登录失败限流与 token 黑名单（登出即失效）。
- **统一响应 / 异常**：`ApiResponse` 统一结构 + `BusinessException` 业务异常体系 + 全局异常处理器。
- **可观测性**：请求日志中间件（注入 `X-Request-ID`、记录方法/路径/耗时）。
- **工程化**：Docker + docker-compose（app + postgres + redis）、Makefile、pytest 基座（FakeRedis + 内存 SQLite，无需外部服务即可跑测试）。

## 目录结构

```
app/
  api/v1/        # 路由层（HTTP 入口）
  services/      # 业务逻辑层
  repositories/  # 数据访问层
  models/        # SQLAlchemy 模型
  schemas/       # Pydantic 请求/响应模型
  core/          # 配置、DB session、安全、Redis、异常、中间件、依赖
alembic/         # 数据库迁移
tests/           # pytest（conftest.py 提供测试基座）
main.py          # 应用装配入口
```

## 快速开始

### 方式一：本地开发

```bash
uv sync                       # 安装依赖（生成 uv.lock）
cp .env.example .env          # 配置环境变量，按需修改
make migrate m="create users table"   # 首次：生成初始迁移（需可连的数据库）
make upgrade                  # 执行迁移
make dev                      # 启动开发服务器 http://localhost:8000
```

### 方式二：Docker

```bash
docker compose up --build     # 一键起 app + postgres + redis，容器启动时自动跑迁移
```

## 环境变量（.env）

| 变量 | 说明 | 是否必填 |
|---|---|---|
| `DATABASE_URL` | 数据库连接串，如 `postgresql://app:app@localhost:5432/app_db` | 必填 |
| `SECRET_KEY` | JWT 签名密钥，生产务必替换为强随机值 | 必填 |
| `REDIS_URL` | Redis 连接串，默认 `redis://localhost:6379/0` | 选填 |
| `ALGORITHM` | JWT 算法，默认 `HS256` | 选填 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | token 有效期（分钟），默认 `1440` | 选填 |

## 常用命令

```bash
make dev        # 启动开发服务器（热重载）
make test       # 运行 pytest（无需外部服务）
make lint       # ruff check --fix + format
make migrate m="描述"   # 生成迁移
make upgrade    # 执行迁移
make clean      # 清理缓存
```

## 基于模板起新项目

1. 复制本目录，改 `pyproject.toml` 的 `name`，`uv sync` 生成新的 `uv.lock`。
2. 配好 `.env`（至少 `DATABASE_URL`、`SECRET_KEY`）。
3. 按分层套路新增业务模块（以 `xxx` 为例）：
   - `app/models/xxx.py` —— 定义模型，并在 `alembic/env.py` 追加一行 `from app.models.xxx import Xxx`。
   - `app/schemas/xxx.py` —— 请求/响应 schema。
   - `app/repositories/xxx_repository.py` —— 数据访问。
   - `app/services/xxx_service.py` —— 业务逻辑（写操作用 `with transaction(db):` 包裹）。
   - `app/api/v1/xxx.py` —— 路由，`from app.core.deps import get_current_user` 做鉴权。
   - `main.py` 里 `include_router` 注册。
   - 业务异常继承 `BusinessException`（见 `app/core/exceptions.py`）。
4. `make migrate m="add xxx table"` + `make upgrade`，然后补测试。

## 认证接口

- `POST /api/v1/auth/register` —— 注册
- `POST /api/v1/auth/login` —— 登录，返回 JWT
- `POST /api/v1/auth/logout` —— 登出（token 加入黑名单）
- 受保护接口在依赖中加 `current_user = Depends(get_current_user)`
