# Verification

状态：passed（本次基础初始化范围）；交付状态：ready_for_review，未自动合并或归档。

## 已验证版本与环境

包含运行代码、规范同步和任务记录的提交：`fc01ccb7c1b045d600ec4d56c2299c6584d66a6d`。

实际证据：[Verify monorepo / run 20](https://github.com/shadowgxq/ai-fullstack-template/actions/runs/35502335952)，2026-09-20 完成，整体 conclusion 为 success。验证在 GitHub Actions Ubuntu / Python 3.12、仓库锁定依赖、专用 PostgreSQL 16 与一次性 Compose 环境中执行。当前证据回写提交只更新本文件、tasks 和 Manager 状态，不改变已验证代码；其自身检查仍由 PR CI 执行。

| 检查 | 实际结果 |
|---|---|
| docs | `make docs architecture` 通过，包含文档链接、任务引用、校验器回归与代码依赖边界 |
| frontend | 锁定安装、`pnpm check && pnpm build`、preview 静态资源检查通过 |
| backend | 锁定安装、`make -C backend check`、OpenAPI 快照检查通过 |
| ai-service | `uv sync --locked`、Ruff lint/format、pytest 36 passed；没有 skipped |
| PostgreSQL | 上述 36 项中有 8 项真实数据库测试，覆盖幂等、scope、Checkpoint 恢复、失锁、独立 CLI Worker 与未知版本拒绝 |
| 安装包 | `uv build` 生成 sdist/wheel；安装 wheel 后切换到源码目录外，module/console 两种自检均成功，SQL 资源存在 |
| AI 契约 | `scripts/export_contracts.py --service ai-service --check` 通过，公开 schema 未变化 |
| stack | 无 AI 的前后端启动、完整栈构建启动、HTTP 与独立 Worker smoke 均通过，测试环境已清理 |

AI pytest 有 1 条 Starlette/AnyIO 依赖弃用警告，不是测试失败；未通过屏蔽测试或降低检查要求使其通过。

## 本地证据与限制

本地运行新增框架无关 `test_runtime.py` 的 5 项 unittest，全部通过；新增 Python 文件 AST 解析、Markdown fence/空白/过期路径检查通过。对照 GitHub blob 校验 pyproject、CI 基线与最终 Worker 内容。

当前容器无法解析 GitHub/PyPI，不能安装完整锁定依赖或运行 PostgreSQL。完整验证以实际 CI 为证，不把局部测试、内存 Checkpointer 或 API schema 自检当成真实数据库与全栈验证。没有使用假依赖替换真实检查。

## 迭代与兼容

`787bc343` 首轮 CI 指出一处 Ruff 换行；`43d6fce8` 修正后运行 36 项测试，35 passed、1 failed。原有失锁用例发现执行注入的关键字参数不兼容既有替身；`80ff5aa7` 保留原位置参数绑定后修复。没有删除或削弱失锁用例，最终同步版本重新通过全部检查。

HTTP DTO、数据库表与迁移、依赖版本及 lockfile、原启动入口不变。Checkpoint 的 thread_id、State 和 Node 结构保持兼容，仅明确 sync durability 并在恢复前拒绝不一致输入。

## 不在本次完成声明内

未调用付费模型、部署生产或迁入参考项目业务。ModelPort/ToolRegistry、Operation Ledger/预算/unknown、人工审批、取消、SSE、Artifact 和多 Worker 仍是后续能力；本次通过不代表完整目标 Runtime 或生产就绪。
