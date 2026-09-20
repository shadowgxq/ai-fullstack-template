# 测试与 Evals

公共验证原则见 [公共工程细则](../../common/README.md#验证范围)。本页定义 AI 服务的证据边界，不设业务质量阈值，也不要求每次修改都运行所有测试。

## 现有测试与命令

当前有 [test_unit.py](../../../../ai-service/tests/test_unit.py)、[test_postgres.py](../../../../ai-service/tests/test_postgres.py) 和仓库级 [smoke.py](../../../../scripts/smoke.py)。replay/evals 目录、真实模型 fixtures 和专门 CLI 尚未提供；以下扩展规则不是已经存在的脚本。

工作目录和命令必须明确。AI 本地检查见 [AI Makefile](../../../../ai-service/Makefile)：`make -C ai-service check` 执行 Ruff 检查、格式检查与 pytest，不包含 build 或类型检查器。目标用例可在 `ai-service/` 下用 `uv run --locked pytest tests/test_unit.py` 或 `-k` 选择真实存在的测试。

PostgreSQL 用例只使用显式 `AI_TEST_DATABASE_URL`，库名必须以 `_test` 结尾；未配置会 skipped，不算恢复验证通过。隔离 scope/Run 和 fixture，不清空共享库。`make smoke` 需要已启动的真实服务，不隐式授权启动、部署或付费请求。

## 按变化选择验证

| 变化 | 必要证据 |
|---|---|
| 仅 Markdown / 文档导航 | 根 `make docs`；不启动业务服务或运行付费 Evals |
| 纯规则、解析、State 更新、reducer | 相邻确定性单测；覆盖分支、非法输入、重复/乱序，而非静态文案 |
| Graph routing、完成条件 | 固定输入 + fake/内存 Checkpointer 的图级测试，验证结果与退出，不锁死无关内部轨迹 |
| 公共 DTO / API | schema 导出与漂移检查、真实 HTTP 契约和直接消费者回归 |
| Store / Worker / 迁移 / Checkpoint | 专用 PostgreSQL integration；必要时独立进程重启 smoke，不能用 SQLite/内存替代 |
| 模型 adapter、prompt、工具 | deterministic/recorded 回归；质量结论另附范围匹配的 Evals |
| 依赖、初始化或跨端实现 | 根 `make check`；相关服务启动后按范围执行 smoke |

对新增或修改的 Python 文件执行配置中的 Ruff 检查。普通局部修改不无条件全量测试或 build；共享协议、恢复或工具链影响无法收窄时扩大到直接相关检查。不要为测试覆盖率新增只断言常量或第三方初始化的用例。

## 三类证据不能互相替代

**Deterministic** 验证协议、分支、权限、预算规则和恢复决策，固定输入与可控依赖。当前 echo 仅能证明它覆盖的路径，不能证明真实模型或通用副作用恢复。

**Recorded replay（扩展时）** 保存脱敏且允许留存的请求/原始响应 fixture、adapter/schema/prompt 版本和预期解析结果。缺 fixture 必须失败，不能自动 fallback live；错误、拒绝、截断、空结果和 usage 缺失也要有样本。录制响应回归不等于进程崩溃恢复，两者分开测试。

**Live / Evals（扩展时）** 只在明确供应商与预算授权下运行。记录 case ID、数据/fixture 版本、模型/配置、时间、用量、失败及局限；judge/rubric 有版本，模型自评不是唯一正确性证据。阈值与金标来自具体任务，不在模板规定“所有业务 95 分”。

## 按新增风险补故障用例

现有 PostgreSQL 测试已覆盖同键冲突、scope 隔离、重复创建、第二 Worker 拒绝、Checkpoint 后发布前恢复、终态防覆盖和失锁后不能写入。修改这些路径时保留对应回归；执行证据以实际测试结果为准。

启用相应扩展时，至少覆盖它新增的窗口：请求发送前/后、响应已保存但 Node 尚未返回、发布前/后、重复或过期回答、取消与迟到响应、观测失败、State/Saver 升级恢复。故障注入应核对持久化结果与外部调用次数，不只断言进程没有抛异常。

测试失败保留证据；不得删金标、屏蔽失败项或切回 echo 后宣称扩展能力通过。交付报告写实际命令、运行环境、passed/failed/skipped/not run 及原因；静态链接检查不证明架构语义或运行正确性。
