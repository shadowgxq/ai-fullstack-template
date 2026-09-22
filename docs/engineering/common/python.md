# Python 公共写法

适用于 backend 与 ai-service 的 Python 代码；命名语义、注释和复用原则见 [公共代码质量](code-quality.md)。只共享语言与边界写法，不统一两个服务的目录、ORM、响应信封或事务实现。

## 命名、类型与数据

- 模块、函数、变量用 `snake_case`，类用 `PascalCase`，常量用 `UPPER_SNAKE_CASE`，私有实现用 `_` 前缀；导入使用显式路径，不用 `import *`。具体包根由各端规范定义。
- 新增或修改的公开函数、Protocol、可替换依赖标明参数和返回类型；简单局部变量可推导，不用裸 `Any` 或无约束 `dict` 掩盖跨模块契约。`__init__` 返回 `None`。
- 纯数据按用途选 `dataclass`、`TypedDict` 或明确类型；`TypedDict` 和普通类型注解不做运行时校验。函数默认参数不用可变容器，dataclass/Pydantic 的可变字段默认值用 factory。
- HTTP、配置和第三方返回等外部边界使用现有 Pydantic v2 schema；使用与锁定版本匹配的 `model_validate` / `model_dump`。已通过相同信任边界的内部对象不逐层重复验证。
- 明确空值、长度、枚举和未知字段策略；需要拒绝强制转换的字段采用严格校验，但不全局机械开启 strict 破坏现有 UUID/日期的 JSON 输入契约。
- `None` 判断与 `0`、空字符串、空集合区分。协议时间使用带时区值；精确金额用 Decimal 或约定的最小单位整数，序列化与舍入由提供方 schema 明确。

## IO 与生命周期

- 纯规则不读取环境变量或网络；配置和 client 由服务入口/工厂注入。新增连接池、文件和 client 要有关闭路径；包导入、schema 导出和离线测试不得发起外部调用。
- 同步调用保持在同步边界；普通 helper 不会仅因被 async handler 调用就自动卸载阻塞 IO。需要异步时明确执行模型，不混用同步 Session 和异步路由来假装并发。
- 并发任务不共享可变事务会话，连接不跨进程复用；并发与重试有界。AI Worker 的同连接保护是具体协议，不得按一般连接池建议拆散，见 [恢复规范](../ai-service/standards/checkpoint-and-effects.md)。
- 捕获能处理的具体异常，在转换时保留原因；广义异常仅留在明确的最外层隔离/记录边界，不伪造成功，不吞取消或框架控制信号。安全日志规则见 [公共配置](README.md#配置与运行环境)。

## 格式与适配

空格、引号、行宽和 import 检查以所在服务 Ruff 配置为准；最低 Python 与依赖版本以本端 `pyproject.toml` / lockfile 为准。公共文档不再维护一份版本表，不为风格统一修改无关文件或新增类型检查器。

backend 的 SQLAlchemy Session、Service 事务、HTTP 错误见 [后端规则](../backend/standards/python-development.md)；ai-service 的 psycopg/Saver、Node 和控制信号见 [AI 规则](../ai-service/standards/python-development.md)。

依据：[PEP 8](https://peps.python.org/pep-0008/)（语言命名与一致性）、[Pydantic strict mode](https://docs.pydantic.dev/latest/concepts/strict_mode/)（边界校验差异）、[FastAPI 并发](https://fastapi.tiangolo.com/async/)（同步/异步执行边界）。采用其中相关原则，工程配置与现有兼容契约仍是本仓库落地依据。
