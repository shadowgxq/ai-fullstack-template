# 实施与验证任务

关联：REQ-MONO-001 / REQ-DOC-001 / REQ-AI-001。共享文档、根配置、锁文件由本次单一实施者写入，不并行覆盖。证据见 [verification.md](verification.md)。

- [x] 工程负责人：三端目录整合，根 Compose/Makefile，保留原前后端基座。
- [x] 文档负责人：公共规范与专项路由，产品/架构/契约单源，根 Manager/OpenSpec，归档旧业务样例。
- [x] AI 负责人：API/Worker、DTO、配置、迁移、确定性图、幂等/事件/恢复、测试。
- [x] 验证负责人：文档与台账、三端 check/build、OpenAPI 生成与漂移检查；真实运行见验证证据。
- [x] 验证负责人：真实 PostgreSQL integration、Docker 整栈启动与 HTTP smoke，全部通过，无 integration skipped。
- [x] 交付负责人：审查变更与未实现边界、补充可复核证据；代码与文档进入同一 PR 评审，不自动合并。

PR 是否创建/合并由 GitHub 状态表明，不再复制一份容易漂移的合并状态。后续需求不得把本次初始化完成误解为目标 Runtime 全部实现。
