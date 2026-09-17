# 实施与验证任务

关联：REQ-MONO-001 / REQ-DOC-001 / REQ-AI-001。共享文档、根配置、锁文件由本次单一实施者写入，不并行覆盖。

- [x] 工程负责人：三端目录整合，根 Compose/Makefile，保留原前后端基座。
- [x] 文档负责人：公共规范与专项路由，产品/架构/契约单源，根 Manager/OpenSpec，归档旧业务样例。
- [x] AI 负责人：API/Worker、DTO、配置、迁移、确定性图、幂等/事件/恢复、测试。
- [ ] 验证负责人：`make docs`、三端 check/build、生成并核对 OpenAPI；记录运行链接与数量。
- [ ] 验证负责人：真实 PostgreSQL integration、Docker Compose 启动和 HTTP smoke；不以 skipped 代替通过。
- [ ] 交付负责人：审查差异与未实现边界，更新唯一进度、验证证据并提交 PR，不合并。
