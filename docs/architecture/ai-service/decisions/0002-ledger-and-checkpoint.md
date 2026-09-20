# ADR-0002：Operation Ledger 与 LangGraph Checkpoint 的职责边界

> 日期：2026-09-16｜状态：proposed
> 实施/验证证据：尚无。

## 背景

模型调用收费且可能出现响应丢失；LangGraph Checkpoint、外部调用与应用数据库不处于同一事务，单靠重试可能造成重复调用或重复计费。

## 决定

Graph State 的持久化与恢复由 LangGraph Checkpointer 管理；外部调用、响应和预算由 Operation Ledger 管理。prepare 阶段先冻结 Operation 并写入 Checkpoint，原始响应持久化后再把 `response_ref` 返回 workflow。恢复时优先复用已保存响应；请求可能已发送但没有响应时保留 `unknown`，不盲目重试。

## 后果

需要维护稳定的 operation identity、短事务，并处理崩溃窗口的状态核对；不能承诺远端 exactly-once，也不能保证供应商不重复计费。进程锁和数据库唯一约束共同保护本地一致性。

## 未采用的替代方案

把 LangGraph Checkpoint 当作完整业务数据库；用 LLM 或 trace 判断是否已执行；所有超时自动重试三次；发现重复后仅删除 Operation Ledger 记录。

## 复议触发条件

供应商提供可验证的远端幂等键或状态查询能力时，可缩小 `unknown` 窗口，但仍保留原记录。多 Worker 需要另行验证旧执行者隔离。

## 关联

运行合同见[Agent Runtime 架构](../agent-runtime-architecture.md)。
