# AI Fullstack Template

全栈 Vibe Coding monorepo：共用文档、任务与验证入口，服务依赖和运行进程分开。

| 目录 | 责任 | 技术基线 |
|---|---|---|
| frontend | 页面、主题、国际化、HTTP 消费者 | React 18、TypeScript、Vite、pnpm |
| backend | 身份、业务 API、事务 | FastAPI、SQLAlchemy、Alembic、PostgreSQL、Redis、uv |
| ai-service | 异步 Run、工作流、检查点、事件 | FastAPI、LangGraph、PostgreSQL、独立 Worker、uv |
| docs | 需求、架构、契约、分层规范 | [文档地图](docs/README.md) |
| manager / openspec | 唯一进度与变更任务 | [交付流程](docs/engineering/workflow/delivery.md) |
| examples | 历史业务材料，不参与当前执行 | [边界](examples/README.md) |

Company Lens 已在原主分支删除，本次不恢复。前后端保留已有基座；AI 默认只运行 echo.v1 确定性工作流，没有真实模型或付费请求。

## 启动全部服务

前置：Docker Engine/Desktop、支持 `--wait` 的 Compose v2、Python 3.12+。Windows 推荐 WSL2；无 make 可直接使用 Docker/Python 命令。

```bash
cp .env.example .env
docker compose up --build -d --wait --wait-timeout 180
python3 scripts/smoke.py
docker compose down
```

前端 `http://localhost:8080`，后端 `http://localhost:8000/docs`，AI `http://localhost:8001/docs`。端口仅绑定 loopback。**此 Compose 使用开发凭证，不适用于公网生产部署。**

PostgreSQL 按服务分库分角色；首次新卷创建账户。两个一次性迁移进程完成初始化，API/Worker 不自动改表。`down` 保留数据卷，不要用删卷代替修复迁移。

## 本地热更新

前置：Node 22、pnpm 10.33.0、Python 3.12、uv、Docker。三端保留独立 lockfile/环境。

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
make install
make infra
make migrate
# 分别在四个终端执行：
make dev-frontend
make dev-backend
make dev-ai
make worker
```

Vite 位于 5173，通过代理访问后端。AI 凭证不进入 VITE 变量。详见 [前端](frontend/README.md)、[后端](backend/README.md)、[AI](ai-service/README.md)。

## 交付与验证

先读 [AGENTS.md](AGENTS.md) → 当前需求/架构/契约 → 涉及端规则。一个跨端需求在同一 OpenSpec change 维护任务，不各建台账。

```bash
make docs             # 导航、规则入口、台账引用、校验器回归
make check            # 三端静态检查/测试、文档、OpenAPI 漂移检查
make contracts        # 接口变化后导出快照并审查 diff
make up && make smoke # 真正启动三端、迁移、Worker 后验证 HTTP 行为
```

CI 使用真实 PostgreSQL 验证 AI 幂等、scope 隔离、检查点恢复、排他；Compose 验证前端资源/代理、后端认证/Redis 登出、AI API→Worker→结果。`/health` 仅存活，`/ready` 检查依赖及已迁移表。

业务 Run 页面、后端到 AI 的用户鉴权转发、SSE、人工中断、取消、预算/调用台账、产物存储、真实模型仍是后续需求。测试客户端闭环不代表业务页面已接通，详见 [实现与目标](docs/architecture/README.md)。
