# 架构复审记录

审查基线：`9db2d617f41bb91eb5443b375d4e8708be79783b`，PR #1 已合并。

| 问题 | 影响 | 本次修正与证据入口 |
|---|---|---|
| 历史记账材料只是搬入 examples | AI 仍可能读取过期业务；模板残留旧计划 | 删除业务材料，当前需求保留；check_docs 的旧目录/skills 回归 |
| 两套 skills、前端旧 Agent 路径、未接入循环脚本 | 多事实源、错误上下文与默认模型/权限耦合 | 根 skills 单源，删除嵌套配置与脚本；执行导航路径检查 |
| 已合并初始化仍在活动任务中 | 进度与 GitHub 事实不符，缺少生效 specs | 归档原 change，同步 specs；新计划引用原归档作为依赖 |
| core/deps 反向依赖业务；AI application 依赖具体 Store | 依赖方向与文档不符 | API 层组合，RunStore 端口；AST 负面用例 |
| Repository 提前 commit | 上层后续失败不能完整回滚 | Service 事务，Repository flush；回滚及唯一冲突回归 |
| 安全 Redis 与缓存均 fail-open | 撤销失效、限流绕过、登出假成功 | 鉴权失败 503、缓存独立降级；故障矩阵及真实 Redis smoke |
| JWT 身份转换与密码字节限制未校验 | 非法输入落入 500；契约与 bcrypt/DB 边界不符 | 安全 401/422、字段限长、HTTP Bearer；边界回归 |
| validation.errors 含 input/ctx，前端读取错误字段不符 | 密码回显/日志泄漏；字段错误丢失 | 仅 loc/type/msg，安全异常日志；前后端契约回归 |
| Worker 锁与 Checkpointer 分属两个连接 | 丢锁旧执行者仍可能写检查点 | 共用锁连接；真实 pg_terminate_backend 后禁止写入且新 Worker 可恢复 |
| AI 未区分可选启动 | 非 AI 产品也默认带整套 Agent 进程 | web-only 独立启动并在 CI 验证，再验证全栈 |

保留边界：认证仍为模板自签 JWT，AI 仍是受信服务令牌与确定性 echo；没有新增业务代理、SSE、外部副作用台账、多 Worker 或生产安全承诺。通用缓存用户快照不等于账号冻结/撤权系统。相关生产需求应另立验收。
