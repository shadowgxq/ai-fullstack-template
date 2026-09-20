# 实现设计

依据 [当前架构](../../../docs/architecture/README.md)、[工程规范](../../../docs/engineering/ai-service/README.md) 和 [跨端契约](../../../docs/contracts/README.md)。

`agent_core.runtime.WorkflowRunner` 只用标准库分派已知 ID；`bootstrap.create_runner` 显式注册 `echo.v1` 并接受注入执行函数。Worker 仍在自己的排他连接上构造 PostgresSaver，通过绑定执行函数推进 workflow，API 不参与执行。保留单 Worker 与短事务，不新增动态插件或第二套业务调度。

`cli.py` 显式提供 api/worker/migrate/check；无参数不启动服务。check 使用隔离配置和实际内存 LangGraph，核对 schema/注册一致性、恢复及包内迁移资源，但输出明确说明 PostgreSQL 未验证。安装依赖本身可能联网；已安装的离线 check 不联网。

echo 开始/恢复显式 sync durability；存在 Checkpoint 时，在执行 Node 前核对冻结输入。旧 thread_id、State 结构、Node 名与数据库表不变，无迁移需求。未注册的持久化版本沿用 execution_failed，不静默猜测新版本。

Worker JSON formatter 只序列化安全上下文，不转储异常或任意 extras。它不承担通用秘密识别，调用者仍须保护 message 内容。未添加远端观测依赖。

验证分为标准库局部测试、真实内存 Graph、专用 PostgreSQL、独立 CLI Worker、wheel 安装后源码外自检、契约漂移与全栈 smoke。使用现有锁定依赖；console script 元数据变化不升级依赖，CI 的 `uv sync --locked` 负责核对锁兼容。
