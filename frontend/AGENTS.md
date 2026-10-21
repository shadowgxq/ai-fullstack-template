# frontend 协作入口

公共约束继承 [根 AGENTS.md](../AGENTS.md)，此处只维护本端任务导航。

- 修改本端代码、设计资产或对应规范前，按 [专项导航](../docs/engineering/frontend/README.md#任务路径) 选择设计准备、已有稿实现、轻量修改或验收入口。前端实现至少读取 [编码规范](../docs/engineering/frontend/standards/frontend-development.md)；仅文档任务读取目标与必要引用。
- 本端设计稿、视觉规范、Token 政策和设计交接由 [design/](design/README.md) 拥有；共享配色与通用交付接口只引用根事实源，不复制小程序规范或任务状态。
- 涉及 API 或跨端数据流时，先读 [跨端契约](../docs/contracts/README.md)；涉及需求拆分或协作进度时，再读 [交付流程](../docs/engineering/workflow/delivery.md)。
- 数据库、缓存、配置、运行环境或跨端验证涉及公共细节时，按需读取 [公共工程细则](../docs/engineering/common/README.md)。
- 安装、启动和检查命令见 [README.md](README.md)。
