# ADR-0001：同包 API 与单 Worker，首期使用共享持久存储

> 日期：2026-09-16｜状态：proposed
> 实施/验证证据：尚无。

## 背景

Agent Run 必须脱离客户端连接持续执行；首期需要缩小分布式故障面，同时 API 与 Worker 必须访问同一运行事实和产物。

## 决定

同一 `ai-service` Python 包构建 API 和 Worker 入口。首期采用单机、单 Worker、PostgreSQL-backed Command Queue 和共享 Artifact Store；API 只读正式产物，Worker 负责写入。

## 后果

进程隔离不等于微服务；队列处理长任务时吞吐有限，单机有故障域风险。公开试用需认证、资源隔离、限额和一致备份。分机前必须替换共享存储方案。

## 未采用的替代方案

浏览器保持连接执行；仅FastAPI BackgroundTasks记录工作；首日引入Celery/Redis或Kubernetes；两台机器各用本地目录。

## 复议触发条件

独立负载测试证明单Worker不足，或部署明确需要分机/弹性时，用新ADR定义对象存储、claim/fencing和共享限流，不只是调高副本数。

## 关联

运行合同见[Agent Runtime 架构](../agent-runtime-architecture.md)。
