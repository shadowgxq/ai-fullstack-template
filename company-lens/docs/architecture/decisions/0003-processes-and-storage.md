# ADR-0003：同包API与单Worker，首期同机共享持久存储

> 日期：2026-09-16｜状态：proposed（双应用目录和单Python包边界已确认；部署假设待采纳）  
> 实施/验证证据：尚无。

## 背景

研究任务须脱离浏览器运行；首次实战需要缩小分布式故障面，同时API与Worker必须能访问同一证据正文。

## 决定

frontend与ai-service为两个应用目录；同一ai-service包构建API和Worker入口。首期建议单机、单Worker、PostgreSQL命令箱、同一不可变正文持久卷；API只读正文，Worker可写。

## 后果

进程隔离不等于微服务；队列处理长任务时吞吐有限，单机有故障域风险。公开试用需认证、资源隔离、限额和一致备份。分机前必须替换共享存储方案。

## 未采用的替代方案

浏览器保持连接执行；仅FastAPI BackgroundTasks记录工作；首日引入Celery/Redis或Kubernetes；两台机器各用本地目录。

## 复议触发条件

独立负载测试证明单Worker不足，或部署明确需要分机/弹性时，用新ADR定义对象存储、claim/fencing和共享限流，不只是调高副本数。

## 关联

关联行为：SYS-003、022、025。系统级合同见[系统技术架构](../ai-architecture.md)。
