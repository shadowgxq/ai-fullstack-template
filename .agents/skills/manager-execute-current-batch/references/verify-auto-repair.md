# 门内有限修复

初次 gate FAIL 不代表需求错误。先按实际证据区分代码缺陷、设计/规格错误、需求变化、环境问题。

代码错误且原要求正确：在当前 apply 的 in-progress 阶段执行 repair-begin --change <id> --finding <问题ID> --allow <精确代码或测试路径...>，取得 key 后仅修这些区域。
修复后 repair-finish --key <key> 检查实际 diff、contract 和归档完整性。有越界、改 Spec、改批准基线或没有进展时阻塞，禁止通过改文档让检查变绿。
每次 revision 的自动修复预算合计最多2次；重启 Goal、换 finding 名称不清零。修复通过范围检查之后，重新运行真实项目检查和独立 Review，再 gate-run；只有新 gate 通过才 advance。

设计或产品需要改变：停止自动修复，通过 manager-revise-plan 做影响分析与真实人工决策。无法复现、缺授权、环境不具备时报告阻塞，不猜修复。
已经 archive-ready 但验收退回的代码缺陷先 reopen --kind code --decision-ref 恢复 apply；不改变正确 Spec，修复预算保留。
任何 Agent 活跃时不修订其 contract。先停止对应原生线程，再显式释放 claim。不得自动删除状态文件来解除阻塞。
