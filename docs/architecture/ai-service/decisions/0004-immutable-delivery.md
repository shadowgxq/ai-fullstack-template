# ADR-0004：不可变产物和绑定 hash 的 Release Gate

> 日期：2026-09-16｜状态：proposed
> 实施/验证证据：尚无。

## 背景

一个经过审计的结果若继续覆写正文、引用或结构化数据，审计结论就不再对应调用方看到的内容；通用 Artifact 下载也可能绕过 Release Gate。

## 决定

Candidate、Audit、Delivery 分别不可变，Audit 绑定准确的 `result_hash` 与 `policy_hash`；Release Gate 在发布事务中检查取消、权限和当前输入，并登记唯一正式 Delivery 引用。只有合法发布的产物可供调用方读取。

## 后果

存储与引用管理增加，修订产生新版本；partial只允许不完整但可靠的内容，已知错误不能放行。取消先接受则禁止随后发布，发布先完成则不回写为取消。

## 未采用的替代方案

覆写同一结果文件；先发布后异步补审计；按同 scope 开放全部 Artifact；通过修改状态为 partial 掩盖已知错误。

## 复议触发条件

结果编辑、分享或公开发布进入需求时，需定义新版本与访问策略，不削弱现有 hash 和审计绑定。

## 关联

运行合同见[Agent Runtime 架构](../agent-runtime-architecture.md)。
