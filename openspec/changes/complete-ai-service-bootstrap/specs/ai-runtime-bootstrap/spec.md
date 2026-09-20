## ADDED Requirements

### Requirement: 可执行的工程初始化

AI Service SHALL 提供显式包入口和受信 workflow 注册分派，保持现有 HTTP 契约、同步存储与单 Worker 边界。

#### Scenario: 离线检查安装包

- **WHEN** 在安装后的环境执行 `ai-service check`
- **THEN** 系统校验实际内存 workflow、公开 schema 与包内 SQL 资源，不连接数据库或模型，且明确说明数据库未检查

#### Scenario: 拒绝不兼容恢复

- **WHEN** 持久化 workflow 版本未注册，或 Checkpoint 输入与冻结 Run 不一致
- **THEN** 系统拒绝错误执行，不自动猜测版本，也不推进不匹配的 Checkpoint

### Requirement: 初始化验收证据

本次交付 SHALL 验证真实 PostgreSQL、独立 Worker、安装 wheel 与既有全栈链路；不得用离线自检替代持久化或服务联通证据。

#### Scenario: 未配置真实测试库

- **WHEN** PostgreSQL 测试没有配置专用 DSN
- **THEN** 结果保留 skipped，不标记为数据库验证通过
