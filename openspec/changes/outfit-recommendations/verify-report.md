# 推荐闭环｜检查证据

Backend、小程序、真实M3跨服务集成及独立审查均PASS，10/10任务完成；本Change与M3为code-verified，三个批次人工验收均pending。严格字体绑定按用户明确例外保留pending。

使用已确认任务PG55432的wardrobe_test与独立wardrobe_ai_test、Redis56379/14。原生制品基于当前实际代码/DTO和只读Pen修订细化，后续检查、原样HTTP、独立审查与人工待验在此统一维护；本项不执行真实模型/微信、浏览器或应用build，不提交/归档/发布。

- 原生制品：proposal/specs/design/tasks按实际schema依赖生成并回读，`openspec validate outfit-recommendations --strict --no-interactive` PASS，apply为ready、0/10；设计源/库当前hash已核对，字体strict binding沿用户已授权例外pending。未把制品或只读准备当作实现完成。

- 2.1原生只读准备：8目标节点（P9tls/ZHXw9/Q3U4y/AvD3c/SKORD/NLCY6/tz4GK/RYACG）、core5组件及双主题变量fresh回读，21处实例/变量alias规范化一致；8次实际prepare仅缺Inter/Noto Sans SC、pin=null，按用户例外保留strict binding pending。receipt/consumption-context/implementation-context在 `/tmp/wardrobe-outfit-design-context/`，context hash eb19e96f8c516f66c3ccddc3c058e3d55e6764f9de6f944234a2e43598dd912b。源/core前后SHA未变，无生产写入。
- 新原生Light图实际查看P9tls/AvD3c；ZHXw9 Get autoheight826px与PNG范围866px存在差异，未发布严格尺寸baseline，视觉/宿主not_run。AvD3c下装示例依正式规则适配为不限类别、即时替换，使用真实Sheet结构而不照搬样例限定；无新增必要产品决定。
- 提供方DTO/五路由冻结后，协调者实际Backend OpenAPI导出+--check、pnpm contracts及contracts:check全部PASS；已释放客户端2.2/2.3并行实现，Backend服务逻辑/持久化检查尚未完成，未勾1.1。
- 独立HTTP消费者四方法（含cancel_by_key）107 passed、两文件Ruff/format PASS，原样AI收据5/5经消费者相等；仅HTTP替身，已交独立只读审查，不作为两服务联调通过。Runtime正补未知映射安全按key原子取消，相关边界完成前保留待验。

- Runtime按key取消补充已独立复查PASS并恢复code-verified；同Reviewer对冻结Backend HTTP消费者子集PASS，无新增P1/P2，复用107项及原样收据证据，1.2完成。其余Backend/客户端及整体M3仍in-progress，网络/TLS待验。

- 根配置按实际Settings接入AI_SERVICE_BASE_URL/API_KEY/TIMEOUT_SECONDS/MAX_RESPONSE_BYTES；Compose仅Backend侧持有受信服务凭据，AI模型供应商密钥仅AI侧。新增按需dispatch profile的有界backend-dispatch（--limit100，restart=no）；根README说明重试及取消清理需重复/周期显式调度，未宣称常驻。PyYAML实际解析与凭据、profile、命令、环境继承断言PASS，未启动任何服务；architecture/diff PASS。
- 运行入口、架构和唯一契约文档同步当前推荐状态、完整组合、来源保存与幂等语义；根README移除已被实现替代的“仅echo/取消与业务消费者未实现”等旧表述。Backend和小程序各自README由实际执行者维护，生成快照仍仅从提供方导出。

- 全Plan结构复核：原生check_plan.py返回ok=true；额外只读核对AC-001～AC-028全部映射到9个Change/3个批次、各报告存在且全部human_acceptance仍pending。根三份受影响人读文档本地链接目标PASS。这是覆盖/引用检查，不替代各能力行为证据；首次临时probe误用changes键已按实际openspec字段修正，产品及Plan未因此改动。

## Backend冻结检查

- 1.1/1.3/1.4/1.5实现与局部检查完成。24个相关文件（22 Python）冻结交独立Reviewer；源码和检查结果核对后勾实施任务，Change仍in-progress，整体审查/双服务集成未通过前不标code-verified。
- 新head73b7b609cd10由实际隔离PG autogenerate生成、父8edcf8789aeb；升级及alembic check通过，旧记录/快照/revision/无来源旧手动收据hash重放完整保留，未改历史迁移。autogenerate自建UUID schema精确清理。
- Backend实际命令：`tests/test_recommendation_postgres.py tests/test_recommendation_evidence.py tests/test_wear_postgres.py tests/test_wear_api_postgres.py`加preferences/profile/weather三个旧迁移用例组合52 passed/0 skipped；后补来源预填归档后拒绝、明确手动过去记录保留及默认缺AI配置、取消投递retryable真/假失败后依赖恢复，共4个新增独立PG用例通过。最终56个不同真实PG用例，无skip。显式测试连接为任务55432/wardrobe_test、Redis56379/14，每例独立UUID schema；不接业务库。
- 规则最终17 passed（含多色ID/中文标签×三种避免集合六例）；`tests/test_wear_history.py tests/test_weather.py`39 passed，两个离线范围不重叠；与前置Change证据有重叠，不累计全Plan总数。22 Python Ruff/format、architecture及Backend diff PASS；最后取消恢复仅定向两文件静态检查通过。
- 新规则先扫描全部库存再三值过滤/软排序/16件输入；无候选零AI，近30日历史及部分天气保持事实，模型语义伪造失败。真实PG覆盖Outbox同事务与回滚、相同key并发、丢映射恢复、lease与截止、双方取消竞争、late回包、revision/天气stale、替换完整组合及来源Wear收据优先。取消清理无论暂时网络或配置/协议错误均保留意图并有界退避，active创建永久失败也登记清理。
- 原样Backend HTTP data位于`.tools/manager-runtime/recommendation-consumer-responses.json`，10410 bytes、11keys（empty/queued/generating/ready/candidates/selection/wear_created/wear_detail/stale/statistics/cancelled）。实际Backend认证/PG/Redis/保存，AI内部边界替身；仅作唯一客户端decoder提供方证据，跨服务运行另验。
- 实际失败修正：测试fixture重复expected_version、旧收据SQL字段名、Outbox初始时钟、multicolor未知成分，以及nonretryable取消错误意图丢失。最终定向通过，未删断言；后二者为本Change自查修复，独立review仍在进行。
- 根收尾复核两份实际生成OpenAPI --check PASS，源wardrobe.pen及core.lib.pen SHA分别仍98404673.../82ac8d54...，本Change无设计源写入。

## M3真实跨服务集成

- 实际执行`backend/.venv/bin/python .tools/manager-runtime/integration_cross_service.py`，exit0。两个独立venv子进程分别使用Backend SQLAlchemy PG与AI独立PG角色；实际Backend认证/业务API/Dispatcher、stdlib HTTP客户端序列化/解码、AI ASGI API/Store/单Worker/PostgresSaver和真实Redis参与。仅微信及外部ModelPort替身，天气本轮未请求；不是TCP/TLS或真实模型证据，不启动服务器。
- 5场景、7组不变量全部true：成功与替换完整校验后显式Wear去重/历史/统计；远端提交后丢响应再以相同key映射同Run；取消先到原子墓碑且无Command/Operation；sending后崩溃新进程unknown不重发；完整原始response已落盘但Checkpoint未推进时换进程复用，禁用模型仍恢复ready。跨账户404、实际Redis撤销后401同链通过。
- 13次序列化HTTP均无Backend活动事务；5个真实AI Run、4次ModelPort替身attempt、2次真实AI进程更换。最终3responded/1unknown Operation全部send_count=1，取消墓碑零Operation/Command；推荐/查看/替换/恢复均不加穿着，只有显式保存1条。
- 原样收据`.tools/manager-runtime/integration-cross-service-378a7015bbd54c85864ed5add7f81c06.json` SHA256 602575b4adbf33a2230b32e46b30fa3def8456e14ddf42508010212b74274f4f；协调者实际回读hash、7不变量、计数与cleanup全通过。harness SHA1b44cb8313a40bb6f14fd3449202280104ffee147628345b2aaaa3c00b51ad7f，AI peer SHA8ce8d1cbe1366f9aa407c23b1d6dda985758d06407d8f5d7fa026e9c2c1ed6f9。两自建UUID schema回查0、Redis私有前缀为空、peer全部wait退出。已交Reviewer审查真实内部接线/断言，不重复旧Runtime故障测试。

## 独立审查与定向修复

- 第一轮Backend审查P2：missing天气建议允许跨日ready，但历史说明只写相对“近30天”，会把旧冻结窗口当当前窗口。根仅修改两处说明为本次参考区间的明确start_date/end_date，不改变时效策略；新增有/无历史×ready后35天真实PG回归，保持ready且只能显示原2026-09-23至2026-10-22。`tests/test_recommendation_evidence.py tests/test_recommendation_rules.py`25 passed/0 skipped（8真实PG+17规则，旧范围不重复计数），两文件Ruff/format PASS。Reviewer定向复查已关闭该P2，其余Backend稳定子集及真实跨服务harness/收据审查PASS，无剩余P1/P2；客户端尚未纳入该结论。

- Reviewer实际审读独立两venv/两库ASGI+stdlib序列化桥、13次无事务HTTP、原样收据SHA、两个新进程恢复、显式Wear及Redis退出断言，确认上述集成证据边界成立；未以它宣称TCP/TLS或真实供应商通过。客户端稳定差量另审。

## 客户端冻结检查

- 2.2/2.3实现与局部检查完成：唯一生成schema+decoder、会话内推荐身份/稳定key、轮询/离页恢复/主动取消、完整替换与迟到校验、来源Wear共用表单、三主入口及旧nativeTab/switchTab调用同步。29文件最终清单/逐SHA在`/tmp/wardrobe-outfit-design-context/client-completion.json`，协调者实际29/29哈希及两个源SHA回读通过；已交独立只读Reviewer，整体Change仍待最后审查。
- 最终定向9文件72 tests PASS，报告`/tmp/wardrobe-outfit-design-context/client-tests.json`；typecheck、定向ESLint/Prettier、check-dist脚本node语法检查、tracked与选定untracked diff PASS。check-dist适配自定义业务路由，仅验证脚本语法，未执行build或声称构建产物检查通过。
- 持久实际Backend收据`miniprogram/tests/fixtures/outfit-provider.receipt`逐字节保留SHA7405a55fcc794913afea0aebc350d73124b6685a52814db1dbb16a5199a1144b，经各状态/完整组合/来源Wear/statistics真实decoder断言通过。额外真实双服务收据SHA602575...74f4f的9类Backend data亦通过唯一decoder临时probe，排除AI原生cancel_tombstone，结果`/tmp/wardrobe-outfit-design-context/cross-service-decoder-result.json`；临时probe已移除，不改提供方响应。
- 最终8目标fresh原生prepare仍仅Inter/Noto Sans SC资源缺失、pin=null，按用户明确Plan例外pending；当前实施上下文hash09889ffd01cf1f85960f7623b5de6621cb50679fb1a98d7e3951c27019b70baf（447files）。wardrobe.pen98404673.../core82ac8d54...前后未变。静态Token/触控/固定区及宿主分层检查不代替设备/视觉，ZHXw9 Get/PNG高差未称严格baseline。
- 客户端自查定向修正隐藏页校验迟到导航、午夜实际服务端重验和忽略abort旧read后的重新进入去重竞争，新增回归通过；未改变Backend时效策略、不将场景/城市下一次选择冒充当前建议依据。1～2组实施任务及3.1集成已勾，3.2整体独立审查待完成。

## 整体收尾

- 独立Reviewer最终客户端2.2/2.3 PASS，无新增P1/P2；核对29文件与源SHA、状态/key/会话/离页/迟到、完整替换/来源保存、真实decoder及三主入口，生产源码无switchTab，使用的Token均有定义。结合已有效Backend/迁移/Runtime/根配置/跨服务结论，整个outfit-recommendations代码验收PASS。唯一审查P2一轮定向修复后关闭，无剩余代码阻塞。
- 协调者最终`pnpm --dir miniprogram tokens:check`与`contracts:check`、architecture/diff PASS；两份提供方OpenAPI drift检查已在最终DTO冻结后通过，历史说明修改未改schema。未重复无变化业务测试、未运行仓库全量check。
- M3逐项覆盖请求/Outbox同事务、映射恢复、Runtime故障恢复/取消竞态、全库存与事实语义、显式Wear闭环、三入口/会话/完整替换，以及契约配置运行文档；复用M1/M2仍有效身份/媒体/历史/统计/偏好/天气检查。Plan28项均有9个Change承担，全部3批次code-verified；code acceptance不替代human acceptance。
- 待验：实际微信首次/再次登录和权限、认证媒体/持久卷与备份、微信模糊定位/地图Key、天气来源生产使用条件、真实模型严格输出/usage、原生宿主安全区/键盘/滚动/窄屏及最终视觉体验。字体Inter/Noto Sans SC严格binding仍pin=null，ZHXw9尺寸差未当严格baseline。此次未调用真实模型/微信、未启动浏览器/devserver/build、未提交/归档/发布。
- 运行边界：Backend Dispatcher是显式有界命令，重试及取消清理须由部署方周期执行；AI单Worker、受信服务身份和两库分角色不变。跨服务证据采用ASGI+stdlib序列化桥，尚无TCP/TLS、部署或真实供应商结论。

- 原生收尾：`openspec validate outfit-recommendations --strict --no-interactive` PASS；实际`openspec instructions apply --change outfit-recommendations --json`返回all_done、10/10/remaining0。最终check_plan结构ok=true、diff PASS，未执行archive。
- 资源收尾：核对本thread owner、PG真实data_directory/55432及Redis PID/exe/56379后，精确移除本任务保留的root_ai_contract UUID schema，回查0；干净停止仅本任务PG/Redis并确认两端口关闭，未删除数据目录或证据。收据`.tools/manager-runtime/cleanup.json`；未触碰业务数据库或其他服务。

## 2026-10-23 接口及交互收尾

- 真实TCP模型主业务链、完整TCP ModelPort替身复验及失败边界见 [Runtime报告](../wardrobe-ai-runtime/verify-report.md#2026-10-23-接入独立复查与-tcp-证据)。原paid harness整体FAIL被保留，不与完整替身PASS混同；无需重复真实付费调用。
- 真实PG/Redis十个业务测试文件组合85 passed/0 skipped；`test_recommendation_rules.py test_ai_runtime_client.py` 125 passed。客户端 `pnpm check` 32文件232 passed、生产构建和产物检查通过，不累计历史重叠用例。
- 独立只读交互审查覆盖实际业务页面/Hooks/service：登录隔离、导航、媒体与表单重试、记录CRUD/统计、个人设置/偏好/天气、推荐生成取消替换确认及迟到响应。唯一P2为统计跨日，已修复、fake-clock真实页面回归及独立定向复查通过；未发现推荐自动记穿着或已确认跨账户泄露。
- DevTools CLI 服务端口关闭，用户明确先完成接口和代码验收；宿主实际全流程未执行，视觉由用户验收。真实微信身份、拍照/相册/定位权限、设备输入与安全区仍需宿主证据，生产接入条件及字体严格绑定仍pending。


## 2026-10-23 M1–M3 当前设计对齐

本轮按当前 `miniprogram/design/wardrobe.pen` 对照 M1–M3 的业务 UI，源稿保持只读。缓存入口为 `miniprogram/scripts/pencil-cache.py`，复用已安装的 `design-to-code` Cache/Flow；真实 Pencil stdio 连接提供观察身份，节点、递归实例、变量、本地图片摘要和 2× PNG 均实际回读。已移除两个读取旧 JSON 的临时 prepare 脚本，原失败回执保留。

### 页面与状态覆盖

| 范围 | 当前 MCP 节点 | 源码核对与调整 |
| --- | --- | --- |
| 微信登录 | H9XUdW | 现有插画、文案、微信按钮、辅助说明和无底部导航符合当前空态结构；保留 pending、错误和重试。 |
| 衣柜及空库存 | ddC69、zkPuC、w2ZdGv | 数量概览使用真实全量统计，三个状态筛选显示实际计数；双列图片、名称字号、属性间距及空库存仅一个添加操作。筛选无结果保留筛选与恢复入口。 |
| 衣物详情 | WV7wn、StjQC | 260px 图片、标题、状态圆角、属性与穿着统计层级；归档使用居中确认，恢复保留真实状态选择。 |
| 添加、编辑与展开 | Ro2vL、FfxoI、jxBYZ、Y8xJCl | 176px 照片区及来源图标、照片移除覆盖层、48px 字段、更多属性与草稿保留；固定保存及键盘处理沿原宿主。 |
| 分类、颜色、标签 | phKmP、zXmjy、kopCO | 分类使用 MCP 原稿导出的 76px 缩略图；颜色改为四列色块、名称、选中标记与清除；快捷色顺序、34px 色块和原稿色值核对，标签沿已有局部结构。 |
| 记录与空历史 | HI38Z、C0p2tC、Ozfkk | 概览采用近30日真实记录数；日期、96px 图片、名称及菜单层级；菜单改为记录旁下拉，删除使用共用居中确认。空历史保留单个记录动作。 |
| 实际穿着及多选 | tz4GK、RYACG、mKPcR | 日期标签、辅助文字、选择入口、160px 预览、112px 多选图和圆角；完成才应用、取消保留。记录详情沿同一真实记录展示，不另造样例页。 |
| 衣柜统计 | ywaWl、a7xEg | 概览、类别分布、条形与148px 趋势区、单件次数逐项核对；趋势轴显示分段起日，完整范围和7/7/7/7/2说明保留，0次与归档不解释为从未穿过。 |
| 长期偏好 | OgxoN、Z8EEvN | 六组偏好、选中状态、舒适度字段与字号、固定保存、冲突保留核对；保留真实目录中的选项与清除操作。 |
| 个人及已登录空态 | QL83M、JGka6、q5sgBH | 渐变资料头、头像、设置入口、内容 Tab 与真实总数、160px 衣物预览、空态和管理入口；资料入口不再打开旧弹层。 |
| 设置 | fkIRs、XzsEz | 补齐资料卡、账户分组、同组偏好/城市入口、隐私提示和58px退出动作；退出复用居中确认。 |
| 独立资料编辑 | LgGyr | 注册 `pages/profile-edit/index`，两个资料入口统一跳转；156px原生头像点击区、相机标记、昵称输入/清空、说明与圆角保存操作。复用同一 editor、上传和版本边界，成功后返回失败只重试导航。 |
| 天气与推荐 | NLCY6、P9tls、ZHXw9、Q3U4y、AvD3c、EI1eW、SKORD | 天气摘要与场景按钮层级、带图标说明的即时场景选择、176px推荐/候选图、替换标记、推荐依据图标/正文层级及空态；保留生成、取消、校验中隐藏旧理由、失败恢复与显式记录。 |
| 共用确认 | m0rZ7 | 归档、退出与删除统一复用 `ConfirmDialog`；删除保留危险语义，归档/退出使用普通主操作。 |

以上共37个唯一节点，包含页面、完整内容源及局部/空态。`source-verification.json` 的37个节点回读均与所选依据一致；每组导出前后也由缓存的 native/dependency fingerprint 检查。没有通过修改 Pen 消除实现偏差。

### 运行接口与适配

- 状态计数补入现有统计快照的 `wearable_count/unavailable_count`，与总数、归档和其它统计在同一条 SQL 中读取，没有新增表、迁移或写操作。提供方 OpenAPI 和小程序类型由既有命令生成；decoder校验非负、单项上界与总数一致性。已留存的旧 HTTP 收据及当前旧提供方允许缺少这两个可选展示字段，缺失时不伪造0；原始收据未改写。
- 真实目录、日期筛选、更多筛选、清除偏好、空历史的统计入口及原生最小48px触控保留；不把示例数量、固定类别或样例天气写进业务。受控推荐理由按实际返回内容分行展示，不补造原稿示例里的天气、偏好或历史事实。
- 颜色继续消费正式主题 Token；新图标沿既有 Lucide形状→遮罩→两主题PNG生成，分类图已进入正式资产目录，生产代码不引用 `.design-cache/`。

### 检查与限制

- 小程序受影响14个测试文件共59项分批通过。首次48项中，穿着表单新增主题图标使纯节点测试缺少Hook隔离；补充测试的图标mock后，该文件2/2通过，原日期/选择断言保留。新增资料页真实Hooks回归覆盖保存成功后返回重试不重复PATCH、切号迟到响应隔离及未知保存结果保留草稿。
- Backend `tests/test_statistics.py` 5/5通过，含真实HTTP/SQLite统计口径及单SQL约束；本轮未新增PostgreSQL运行结论。受影响Python Ruff/format通过。
- 小程序typecheck、受影响ESLint/Prettier、Token与生成契约检查通过；9个受影响SCSS及未改动的空态参考样式实际编译，Token引用核对通过；27项关键几何/字号直接对照MCP native数据，27/27一致。这是源码核对，不是运行画面的像素比对。
- 原始证据位于 ignored `.design-cache/current/`：`*/native.json`、`resolved.json`、`after.json`、`prepare.result.json`、`baseline/`、`source-verification.json`、`geometry-audit.json` 与检查输出；不可变快照在 `.design-cache/snapshots/`，无活动pin。
- 字体资源 Inter/Noto Sans SC 未核实，实际prepare仍报告 `dependencies-unresolved`，不产生有效pin或严格绑定；适配器完整采集但严格依赖未就绪时以exit 2结束；最终衣柜真实MCP冒烟已确认exit 2且0活动pin，回执为 `.design-cache/current-smoke/process-exit.json`。导入实例只证明消费稿实际加载内容，不伪造独立库源同步证明；独立库源工具读取未成功。当前安装的目标绑定接口也未提供weapp平台，本轮未用web/iOS/Android标识冒充小程序绑定。
- `runtime_checks=not_run`、`visual_checks=not_run`，human_acceptance继续pending。未启动浏览器、微信宿主、服务或构建，未提交、推送、归档或发布；现有dist不作为本轮源码效果证据。
