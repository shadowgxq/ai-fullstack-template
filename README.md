# AI Fullstack Template

全栈 Vibe Coding monorepo：共用文档、任务与验证入口，服务依赖和运行进程分开。

| 目录 | 责任 | 技术基线 |
|---|---|---|
| frontend | 页面、主题、国际化、HTTP 消费者 | React 18、TypeScript、Vite、pnpm |
| backend | 身份、业务 API、事务 | FastAPI、SQLAlchemy、Alembic、PostgreSQL、Redis、uv |
| ai-service | 持久化 Run、workflow、Checkpoint、事件 | FastAPI、LangGraph、PostgreSQL、独立 Worker、uv |
| docs | 需求入口、架构、契约、工程规范 | [文档地图](docs/README.md) |
| manager / openspec | 执行索引与变更任务；模板初始为空 | [交付流程](docs/engineering/workflow/delivery.md) |

模板提供前后端工程基座；AI 默认只运行 `echo.v1` 确定性 workflow，没有真实模型或付费请求。使用方的产品需求从 [产品入口](docs/product/README.md) 建立，不继承模板维护记录或演示业务 PRD。

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

先读 [AGENTS.md](AGENTS.md) 与 [工具兼容边界](docs/engineering/workflow/tooling.md)，再按 [交付流程](docs/engineering/workflow/delivery.md) 进行工作分级、技术方案批准、近期垂直 change 和实际验收。同一端到端意图跨端交付，不按端各建台账；当前模板未接入 Manager v2 自动控制，不把文档更新当成运行工具升级。

```bash
make docs             # 文档导航、内容卫生、任务引用、校验器回归
make check            # 三端静态检查/测试、文档、OpenAPI 漂移检查
make contracts        # 接口变化后导出快照并审查 diff
make up && make smoke # 启动三端、迁移、Worker 后验证 HTTP 行为
```

CI 使用真实 PostgreSQL 验证 AI 幂等、scope 隔离、Checkpoint 恢复、排他；Compose 验证前端资源/代理、后端认证/Redis 登出、AI API→Worker→结果。`/health` 仅存活，`/ready` 检查依赖及已迁移表。

业务 Run 页面、后端到 AI 的用户鉴权转发、SSE、人工中断、取消、预算/Operation Ledger、Artifact Store、真实模型尚未实现。测试客户端闭环不代表业务页面已接通，详见 [实现与目标](docs/architecture/README.md)。

## 不需要 AI 的业务

`make up-web && make smoke-web` 只构建并启动前端、后端及其 PostgreSQL/Redis 依赖，不启动 AI API/Worker。`make up && make smoke` 保留完整三端验证入口。停止均用 `make down`，不删除数据卷。

Agent 工具与权限配置见 [工具入口](docs/engineering/workflow/tooling.md)；模板文档与维护记录的归属见 [文档维护规则](docs/README.md#文档维护规则)。

文档/计划检查使用独立的固定 PyYAML 6.0.3 工具环境（由 `make docs` 调用 uv，首次需联网，后续可复用缓存），不依赖后端虚拟环境；`make architecture` 检查静态导入和事务边界。所有实际版本以各端锁文件为准。
