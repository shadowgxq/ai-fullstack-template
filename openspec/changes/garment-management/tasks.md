# Tasks

## 1. 共享业务基础与衣物 Backend

- [x] 1.1 衣物 Backend 执行者独占 `account_revision`/`idempotency_receipt` 模型与仓储、注册/微信首次账户初始化及迁移整合；实现账户先锁、不可变收据、规范 hash，媒体模型就绪后串行 autogenerate 并检查迁移；以旧 head 升级、新旧账户初始化及相邻事务测试验证。
- [x] 1.2 衣物 Backend 执行者在 `backend/app` 衣物/catalog 模块交付目录、schema、本人 CRUD/三状态/游标筛选和版本/幂等规则，按冻结媒体接口校验绑定；测试空实体、多选未知值、跨账号、重放/冲突、版本和 revision 同事务。
- [x] 1.3 衣物 Backend 执行者独占 `dependencies.py`、`main.py`、config/exceptions、metadata 注册、pyproject/uv.lock、README/env 和迁移链，串行整合媒体执行者出口及 Pillow/python-multipart；以导入、静态检查和 provider OpenAPI 验证实际路由可达及配置安全。

## 2. 私有媒体 Backend

- [x] 2.1 媒体执行者只写独立 `media_asset` 模型、media 仓储/schema/service/store/API 及相邻测试，复用共享 RevisionRepository；交付认证 multipart、内容解码/限额/去 EXIF 重编码、用途与 owner 校验、pending→ready 和同键恢复；用真实临时图片/文件及失败注入验证，不改共享整合文件。
- [x] 2.2 媒体执行者在同范围实现鉴权内容读取、24h 未引用/长期 pending 后台清理 CLI、deleting/deleted 墓碑与发布/删除文件锁；验证现存引用保护、清理失败重试和迟到上传不复活，返回共享装配/配置/命令清单由衣物执行者整合。

## 3. 小程序衣柜与表单

- [x] 3.1 客户端执行者通过 `design-to-code` 实读 `design.md` 指定列表/详情/表单/选择局部，扩展 `features/wardrobe` 宿主及业务组件，新增真实衣柜/详情/添加编辑路由并接通登录来源/fallback；以静态 Token/两主题/空错忙/触控及路由检查验证，不生成未来推荐或记录占位，不改 Pen。
- [x] 3.2 客户端执行者消费生成 DTO 实现衣物 gateway/运行时 decoder、PATCH/幂等 header、选择目录/筛选分页与草稿保存；分别拍照/相册、单张照片更换移除、认证上传下载和临时路径/草稿会话隔离；测试稳定重试身份、迟到响应、401/切号、弹层取消、多选折叠保留及保存失败恢复。
- [x] 3.3 客户端执行者落实固定操作与键盘避让、详情三状态/归档确认、清空类别颜色、空衣柜/筛选恢复，基于真实 API 刷新；用受影响类型/lint/组件或状态逻辑测试验证，不宣称未运行的视觉/真机效果或虚构穿着次数。

## 4. 契约、真实集成与 M1 收尾

- [x] 4.1 协调者在 schema 稳定后导出 Backend OpenAPI、生成小程序类型，检查漂移和直接消费者，更新相关契约/运行说明；不手写生成物，不扩大到无变化服务。
- [x] 4.2 Backend 执行者与协调者在本次隔离 PostgreSQL/Redis 和临时媒体目录验证真实微信替身→本人衣物/媒体授权链、幂等并发、version/revision 原子性、媒体文件/DB 部分失败及绑定/清理竞争；保留现有数据，仅清理自己创建的 schema/键/文件，证据记 `verify-report.md`。
- [x] 4.3 独立只读 Reviewer 审查整个 Change 稳定 diff 与相邻检查，修复后定向复查；协调者补 M1 共享接口、迁移及登录/会话/媒体消费者集成检查，全部通过才回写本 Change 和 M1 code-verified，真实微信/媒体权限、卷备份、字体绑定和最终产品体验保持 pending。
