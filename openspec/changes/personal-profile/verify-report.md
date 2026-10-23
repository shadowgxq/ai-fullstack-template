# 个人资料与设置｜检查证据

当前 code-verified，人工验收 pending。Backend与客户端按明确文件边界完成，提供方schema已统一生成并检查直接消费者。

- 原生 OpenSpec 已创建 proposal/specs/design/tasks，`openspec validate personal-profile --strict --no-interactive` 通过，apply ready、6项任务；不等于实现通过。
- 已只读核对当前profile GET、模型/仓储/服务、认证直接消费者和avatar媒体链；需要新增版本/PATCH并统一扩展现有媒体用途，不能复用garment用途响应冒充头像。
- Profile schema/API已冻结，协调者已实际检查并执行 `python3 scripts/export_contracts.py --service backend`、`pnpm --dir miniprogram contracts` 生成统一契约；客户端直接消费生成的ProfilePatch/ProfileResponse.version，未手写生成物。提供方与直接消费者检查证据如下。
- 已真实读取个人/设置/资料节点及库/变量，保存源当前 SHA256 `85d689c39066637d8fbc3e9c6ce74899f29d316059c566c0d8edb004da2f874c`，个人内容Tab/独立设置目标的真实用户决定见 [manager/progress](../../../manager/progress.md)。此前当前390 Light预读证据 `/tmp/wardrobe-m2-account-stats-*`；没有把记录Tab复用规则当成已渲染或运行结果。
- Backend规则与微信默认资料直接消费者：`uv run --locked pytest -q tests/test_profile.py tests/test_wechat_session.py` 49 passed（与前置微信范围重叠）。仅default资料响应补version，不改登录协议。
- 明确指定本任务55432 PG/56379 Redis db14后，`uv run --locked pytest -q tests/test_profile_postgres.py` 6 passed、0 skipped。唯一迁移 `5dbf2ea7379b` 从 `d6ec6e2bad7c` 在UUID schema autogenerate，仅增加version与正数约束；验证旧非空昵称/legacy avatar/city、衣物/历史及revision完整保留，升级后 `alembic check` 无差异。无业务库迁移、数据清洗或新avatar FK。
- 真实PG检查包括已预读profile的同版本两线程竞争、头像绑定/清理各自先胜时的实际文件与引用、提交失败回滚，以及真实HTTP登录→私有avatar/garment上传→owner/purpose/ready校验→资料保存/读取/清除→退出撤销链。仅外部微信交换为边界替身，内部HTTP/ORM/PG/Redis及临时文件真实。
- Backend10个相关文件Ruff/format、architecture及diff通过；独立只读Reviewer审查Backend/迁移/默认资料及契约PASS，无剩余Backend阻塞，未重复执行测试。实际非凭据data于同次HTTP检查导出 `.tools/manager-runtime/profile-consumer-responses.json`，包括default/saved/reread/cleared（versions1/2/2/4）及avatar_ready/garment_ready。
- 协调者 `pnpm --dir miniprogram exec vitest run tests/.manager-profile-consumer.test.ts`：2/2 passed（19:46:29，4ms），实际6种HTTP data原样送入唯一parseProfile/parseMedia并深相等；验证版本与null保留、保存后重读一致、avatar/garment跨用途解码拒绝。fixture未修改，临时probe已移除；这不是微信宿主操作验收。
- 客户端已实读当前个人/设置/资料源与6个递归引用组件及变量；390 Light/360 Dark共6图已实际查看，3个root prepare仅字体缺失pin=null，helper已正常退出。最终native实读与初次节点/递归组件/变量全等，源SHA256仍 `85d689c39066637d8fbc3e9c6ce74899f29d316059c566c0d8edb004da2f874c`、公共库未变；临时依据 `/tmp/wardrobe-profile-current-native.json`、`/tmp/wardrobe-profile-current/` 和 `/tmp/wardrobe-profile-prepared-*.json`。
- 客户端定向42/42 passed（profile12、原生表单事件3、session13、wardrobe14，与前置会话/衣物范围重叠），typecheck、受影响ESLint/Prettier、tokens:check、contracts:check、diff通过；协调者提供方OpenAPI drift check通过。个人页复用真实GarmentGrid/RecordCard和查询，不使用样例或已载入页数冒充全量；唯一媒体链移到shared/api/media，旧入口移除并更新调用，传输显式区分avatar/garment。
- 资料保存保持固定版本，未知结果先GET核对；冲突可见读取最新头像/昵称并更新查询缓存，不覆盖当前草稿或自动提升expected_version。测试覆盖保存/上传失败身份保留、取消/关闭/切号及恢复GET刚解决时的迟到回包；chooseAvatar/nickname组件事件来自已核实的Taro props，不能当作微信宿主通过。
- 客户端28个目标及集成已完成最终独立只读审查PASS，无剩余代码阻塞；Reviewer确认真实分页/展示复用、媒体用途、固定版本与关闭/切号隔离、冲突反馈、Token定义/两主题资源及原代次退出反馈。协调者源文件与库SHA复核一致，旧媒体入口无残余调用，diff检查通过。未重复执行已有效测试。
- 字体严格绑定按Plan例外pending，宿主权限、原生昵称审核/头像事件的宿主行为、实现视觉及产品验收not_run；偏好/城市随对应Change接通，不指向模板假业务。阶段状态以manager/progress为准，不因本项代码通过代写产品已接受。
