# 本次验证记录

审查基线 `9db2d617f41bb91eb5443b375d4e8708be79783b`；PR #2，不复用 PR #1 的绿灯。

[本次完整运行 35306894945](https://github.com/shadowgxq/ai-fullstack-template/actions/runs/35306894945) 对应分支提交 `d633760847ee5854dd3a8ef425a9150eb52cfc33`，五个 job 全部成功：

| 范围 | 已执行结果 |
|---|---|
| 文档/架构 | 依赖隔离的 YAML 解析、导航/引用/长度校验、仓库规则测试、AST 越层与事务边界检查通过 |
| 前端 | 冻结安装、类型、严格 lint、单测、格式、构建及 preview HTTP 通过；包含 data 字段错误直接消费者回归 |
| 后端 | 冻结安装、ruff、pytest、OpenAPI 漂移通过；包含安全 Redis 故障矩阵、JWT/凭证边界、脱敏、回滚和唯一键冲突 |
| AI | 冻结安装、ruff、pytest、包构建、契约通过；真实 PostgreSQL 集成包含锁会话终止后的检查点隔离与恢复 |
| Docker | 先只启动前后端及其依赖并确认无 AI 进程，再启动完整栈；代理、DB 注册登录、Redis 撤销/失败计数与限流、AI Worker 生命周期 smoke 均通过 |

最终目录复核补充：删除归档后遗留的活动 change 副本，并新增“归档与活动目录不得同时存在”的回归。本地仓库规则测试为 21 项全部通过，71 份活动 Markdown 的导航/引用通过。收尾提交仅涉及该副本删除、门禁、进度和证据；最终 SHA 的复验以 [PR #2 Checks](https://github.com/shadowgxq/ai-fullstack-template/pull/2/checks) 为准，PR 描述记录最终成功运行。

`docs/product/team-site.md` 与基线逐字节一致；数据库迁移未修改。一次性准备文件和写权限 workflow 已移除，持久 CI 仅 contents:read。归档只留一份历史事实，当前 change 在合并前不归档。

未执行：付费模型、生产部署、浏览器视觉、Windows 原生、负载与渗透测试。模板自签 JWT、开发凭证、确定性 echo 和单 Worker 不等同于生产多租户/完整 Agent 产品。自动门禁只验证显式结构约束，语义合理性仍需评审。
