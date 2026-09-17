# 前端接口接入

当前接口语义以[执行设计第15节](../../../docs/design/AI-Agent通用模板_技术设计与实现规范_v1.1.md)和[业务结果合同](../../../docs/design/AI公司研究_业务架构与接入设计_v1.1.md)为准。表与控制事务、公开 DTO、SSE 快照及访问控制细化见[系统接入设计第1–5节](../../../docs/design/system-integration-details.md)。后端实现后导出公共 schema，前端在现有 API/repository/mapper 接入。

## 旧代码参考

以下文件保留原路径，供已复制代码中的注释和迁移查阅；它们描述旧 AI Berkshire 服务，不是 CompanyLens 后端的需求、待办或已完成证据。

- [公司研究旧接口](company-research.md)
- [旧前端接入问题记录](company-research-frontend-gaps.md)
- [旧后端契约缺口](company-research-backend-gaps.md)
- [旧账号密码契约缺口](account-password-backend-gaps.md)

接入新服务时按新合同替换，不在这些历史文件中追加新的权威接口定义。
