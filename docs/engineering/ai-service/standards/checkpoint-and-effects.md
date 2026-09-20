# Checkpoint、事务与副作用

现有持久化规则由 [worker.py](../../../../ai-service/src/ai_service/worker.py)、[store.py](../../../../ai-service/src/ai_service/infrastructure/store.py) 与 [真实数据库测试](../../../../ai-service/tests/test_postgres.py) 共同约束。扩展设计依据 [ADR-0002](../../../architecture/ai-service/decisions/0002-ledger-and-checkpoint.md)，不是已落地声明。

## 当前必须保持的不变量

- Run 与待执行命令同事务写入；应用状态与对应事件同事务更新。不能先返回创建成功，再尝试写队列。
- 当前使用数据库级单 Worker 会话锁，不是已经支持多 Worker 的 per-Run claim/fencing。Worker 锁、`PostgresSaver(connection)` 和应用写入共用同一 psycopg 连接。
- 同连接不等于同事务：Checkpoint 与应用状态独立提交。保留短事务，不把网络请求、整个 workflow 或等待人工回答包进事务。
- 连接丢失后旧执行者必须停止推进；不得自动换一条 Saver 连接继续写。释放 Worker 锁前完成当前图调用的写入收尾。
- 应用结果只按合法状态迁移发布，已完成结果不可覆盖。重启先查同一 Run 的 Checkpoint，不新建 thread 来伪装恢复。

现有 echo 使用 `thread_id = run_id`，没有状态则开始、有待执行节点则恢复、已完成则读已保存结果；这套简化判断只覆盖当前确定性链路。接入 interrupt 或新错误状态时，必须检查等待/错误语义，不能仅凭 `snapshot.next` 就自动继续。

## 迁移与兼容

应用 SQL 迁移按版本追加，已应用文件不能修改 checksum；Checkpoint 内部 DDL 交由所选 Saver 管理。应用迁移与 `saver.setup()` 分开执行，不在 API import、请求或自动启动路径中建表，见 [迁移入口](../../../../ai-service/src/ai_service/infrastructure/migrate.py)。

改变 State、Node 名称、workflow 版本或 Saver 依赖时，说明旧 Run 可以直接恢复、需要迁移还是必须阻断；兼容结论要有旧 Checkpoint fixture 和真实数据库用例。升级不能默默清空旧状态来让测试通过。

## 外部副作用（扩展时）

当前无 Operation Ledger / 预算实现。接入付费模型或写工具前，按以下阶段建立可验证边界：

```text
冻结 Operation 身份与 payload
  → prepare Node 返回，并确认相应 Checkpoint 已持久化
  → 短事务登记 attempt 与预算预留，提交
  → 在事务外执行受控外部调用
  → 持久化完整响应引用与已知 usage
  → 将 response_ref 返回 workflow
```

不能把 SDK 调用放在 prepare Node 返回之前，或把 `state.update()` 当作 Checkpoint 已提交。需要下一步开始前完成持久化的路径，应在锁定版本验证并显式选择 `durability="sync"`；当前 echo 未显式设置该参数，不把新要求描述为现有配置。模式语义见 [官方 Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)。

Operation 身份区分逻辑操作、输入版本与 attempt；重放复用同一逻辑操作，不每次随机生成新身份。公共请求 `Idempotency-Key` 不能代替每次供应商请求的副作用记录。

| 恢复证据 | 处理 |
|---|---|
| 已持久化匹配的响应 | 复用 response_ref，不重复发请求 |
| 能证明未发出 | 在授权、预算与有限重试策略内重新尝试 |
| 可能已发出但无已存响应 | 记录 `unknown`，保留预算预留；先核对或人工处理，不盲重发 |
| 供应商支持可验证幂等/状态查询 | 在 adapter 中按真实能力核对；仍保留请求与响应记录 |

`unknown` 是扩展调用状态，不是当前 Run 状态枚举。Checkpoint、数据库唯一约束和供应商调用不构成分布式事务，不能承诺远端 exactly-once 或绝不重复收费。

## 人工等待、取消与扩容（扩展时）

回答绑定 Run、当前 interrupt/等待身份和输入版本，先做授权与幂等校验，再由 Worker 消费；拒绝过期回答和不匹配的继续操作。等待不能占住数据库事务；暂停是否释放执行槽必须由实际调度与恢复测试证明。

取消意图与最终发布按应用事务裁定；迟到响应仍保存到调用记录，但不得绕过取消状态发布。发布先完成则不回写为取消。多 Worker 需新增 claim、heartbeat、fencing 及旧执行者隔离，不只是增加副本数。
