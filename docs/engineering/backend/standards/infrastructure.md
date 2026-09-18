# 后端基础设施

## 配置与会话

配置只经 `app/core/config.py` 读取；默认 Python 3.12 与同步 SQLAlchemy/psycopg2。环境变量、安装和迁移命令见 [后端 README](../../../../backend/README.md)。core 不导入业务 model、repository、service 或 API。

请求由 `get_db` 提供 Session。service 通过 `transaction(db)` 收口 commit/rollback；repository 只 query/add/flush/refresh。新模型通过 Alembic 迁移，不能在请求中 create_all。并发唯一冲突由 service 在 rollback 后转换为业务错误。

## Redis

可选缓存使用 `redis_safe`：连接/读写失败返回明确的未命中或无操作，业务可回源。认证失败计数、token 撤销写入与撤销检查使用 `redis_required`：RedisError 转稳定 503，不放行，不伪报登出成功。客户端连接和读写有有限超时，日志只记录操作名/异常类型，不含凭证或原始异常正文。

登录计数使用事务 pipeline 原子执行 INCR 与 EXPIRE NX，首次失败启动窗口，不在后续失败中刷新窗口。缓存不是权限事实源，不能以缓存未命中等同于授权。

## JWT 与错误

JWT 使用 python-jose 和 bcrypt；登录为 JSON 接口，OpenAPI 使用 HTTP Bearer，不宣称 OAuth2 password form flow。`api/dependencies.py` 装配凭证校验，拒绝缺失/错误的 sub、exp、jti；`WWW-Authenticate` 等 HTTP 错误头必须保留。

bcrypt 密码按 UTF-8 字节限制为 1–72 字节，拒绝静默截断；用户名匹配数据库长度并拒绝空白。验证响应仅公开字段路径、错误类型与消息，不回显 input/ctx；日志不记录密码、token、SQL 参数或请求正文。通用异常返回稳定 500 与请求 ID，安全诊断只记异常类型。

更多响应规则见 [契约规范](api-and-error-contract.md)，跨端语义见 [根契约](../../../contracts/README.md)。
