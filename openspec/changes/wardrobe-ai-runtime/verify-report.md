# 穿搭推荐 AI Runtime｜检查证据

状态：code-verified。原7项及联调补充3.3均完成必要检查与独立复查，8/8任务通过；下游outfit-recommendations继续实现。

## 范围与环境

新增wardrobe.recommend.v1严格DTO、服务端冻结执行描述、prepare→invoke→validate、ModelPort/固定Responses adapter、每Run单Operation、取消及原子终态；保持echo.v1公开接口与真实旧Checkpoint。原0001 SQL无改动，仅追加0002。29个AI相关文件的实际diff包含源码、资源、迁移、端内配置/说明及受影响测试。

专用环境为本任务 `.tools/manager-runtime/postgres` 的PG16.2、127.0.0.1:55432，独立数据库/非特权角色wardrobe_ai_test；协调者核验data_directory、数据库/角色/端口，归属记录ai-database-owner.json。PG测试每项使用独立UUID schema并只清理自身fixture，未触碰Backend库或既有业务环境。

原生 `openspec validate wardrobe-ai-runtime --strict --no-interactive` PASS，实际apply contextFiles已消费；制品通过不代替实现检查。

## 实际检查

下列AI命令在ai-service/执行；AI_TEST_DATABASE_URL指向上述已确认独立AI测试库，不含生产连接。

```bash
.venv/bin/pytest -q tests/test_wardrobe.py tests/test_unit.py tests/test_runtime.py tests/test_bootstrap.py tests/test_wardrobe_contract.py tests/test_model_adapter.py
AI_RUNTIME_CONSUMER_RESPONSES=/home/gxq/learnSpace/worktrees/wardrobe-full-flow/.tools/manager-runtime/ai-runtime-responses.json .venv/bin/pytest -q tests/test_wardrobe_postgres.py tests/test_postgres.py tests/test_postgres_bootstrap.py
.venv/bin/ruff check src tests
.venv/bin/ruff format --check src tests
```

- 离线/DTO/Graph/adapter/旧Runtime：186 passed、5 subtests passed；其中独立adapter56、独立DTO/HTTP门禁63已纳入，不重复累加。
- 真实PG/Worker/PostgresSaver/独立CLI及旧echo：24 passed、0 skipped。覆盖同步prepare已可读且发送时事务IDLE、未sending恢复一次发送、sending崩溃unknown不重发、持久响应在模型disabled/无key的独立CLI恢复复用、非法输出不修复、known/unknownusage持久化、取消双方先胜/迟到证据、真实pg_terminate_backend失锁不重连、显式unlock拒绝旧授权、旧checksum/数据/echo Checkpoint升级保留。自洽重算Checkpoint hash仍不得改prompt/schema/token参数。
- Ruff及format：PASS，38 files already formatted。
- 仓库根 `python3 scripts/check_architecture.py`、`git diff --check -- ai-service`：PASS。
- `/tmp`下以实际安装的绝对路径分别执行 `.venv/bin/python -m ai_service check`、`.venv/bin/ai-service check`：均status=ok、两注册workflow、postgresql=not_checked、external_calls=not_enabled。安装为editable；未构建或验证wheel。

## 根契约与直接形状核对

- `python3 scripts/export_contracts.py --service ai-service`及安全422修复后的`--check` PASS；生成快照来自实际提供方。现有scripts/smoke.py仍消费旧echo字段，未提前实现Backend推荐Change。
- M2真实PG/HTTP原样天气default/selected/missing映射严格WardrobeInput，3/3通过，partial事实和缺失原因原样保留；证据ai-weather-shape-check.json。仅证明形状兼容，不证明推荐硬过滤已实现。
- 协调者在自身AI schema真实迁移及API创建wardrobe，验证queued取消、重复取消、同key重放、跨scope GET/cancel404、body scope422、result409、持久queued/cancelled事件与零Operation/Command；全部通过，原样响应ai-runtime-contract-responses.json，归属ai-contract-schema.json。
- 执行者8组实际API响应ai-runtime-responses.json已回读，通过真实RunView/RecommendationOutput/EventView及状态/echo输入输出关系断言；公开快照无原始响应、供应商请求体、执行描述、scope或凭据。上述收据均在根.tools/manager-runtime/，无真实模型或用户数据。
- Compose YAML解析、六项AI_MODEL_*默认值与Settings、仅AI进程注入检查PASS。默认disabled、空model/key；根契约、架构现状、技术基线和受影响模型/API/Checkpoint/测试规范已同步，相关diff --check通过。未启动Compose/浏览器/开发服务器。

## 修复与审查

- 独立Reviewer发现P2：wardrobe自由文本NUL原可通过DTO但被JSONB拒绝。实现改为递归拒绝NUL/非法UTF8，不清洗或截断，echo DTO保持兼容。
- 独立门禁初轮60 passed/1 failed进一步暴露默认422回显lone surrogate导致编码异常；改为仅loc/type/msg、去input/ctx并ASCII JSON安全序列化，最终63/63通过，非法文本422且Store零调用、合法202对照通过。Reviewer定向复查PASS，P2关闭；adapter前审无其它阻塞。
- 旧CLI相邻测试首轮遗漏新owned_database fixture import出现2 errors，保持原断言补齐fixture后最终24项全通过。
- 协调者首轮harness误用libpq conninfo被Settings正确拒绝，改为URL query options后同schema通过；收据核对曾误写echo文本常量，改为与原input比较后通过，均未修改产品校验。
- 最终独立只读审查PASS：Store/Graph、至多一次调用/恢复/取消/失锁、迁移/echo兼容及新增根配置/契约/资源/文档一致，无剩余P1/P2。复用186项离线和24项真实PG证据，未重复无疑点检查；任务3.2完成，标code-verified并释放下游。

## 待验边界

指定网关/gpt-6.1-sol 的单case结构化输出、usage 和业务发布已真实通过；生产容量、推荐质量及部署后TLS仍待验。HTTP边界替身经过真实stdlib解析/序列化，socket读写有剩余deadline，OS DNS解析仍依赖宿主解析器，不声称可强制中断。无wheel、生产部署、多Worker或金额预算平台验收结论。本Change无UI；M3阶段、微信/媒体/定位与最终产品/字体/视觉验收继续pending。

## 未知Run身份取消补充

Backend取消清理不能通过create同key排队可能尚不存在的新任务。新增POST /api/v1/runs/cancel-by-key，复用严格CreateRun、受信scope及同Idempotency-Key；同事务记录cancelled Run/event且无Command，或共享既有锁内取消/终态裁定。create重放返回同Run，异input409，不修改模型图/迁移或既有执行链。正式技术方案§4/6及两受影响Change设计同步，模型行为/费用授权未扩展。

- `AI_TEST_DATABASE_URL=<已确认独立AI库> .venv/bin/pytest -q tests/test_cancel_by_key_postgres.py tests/test_wardrobe_postgres.py tests/test_postgres.py tests/test_postgres_bootstrap.py`：31 passed、0 skipped（新增7项+既有24项，勿与前轮累加），9.37s。包含取消先到的无Command tombstone/后续create/config变化重放、scope/同key异input、queued/running/completed/failed、8线程创建取消竞争、inflight迟到证据不发布。
- `.venv/bin/pytest -q tests/test_unit.py tests/test_runtime.py tests/test_bootstrap.py tests/test_wardrobe_contract.py`：91 passed、5 subtests passed；未重跑未变adapter/图测试。
- 修改的Store/port/application/API与新增PG测试五文件Ruff/format PASS；architecture、scoped diff PASS；AI OpenAPI实际导出+--check PASS，cancelRunByKey成功200。仅依赖已有Starlette/anyio BlockingPortal弃用警告，未改无关依赖。
- 本补充由协调者实现，原独立Reviewer定向只读复查PASS：按key取消墓碑、并发收敛、终态/事件和后续创建不排队模型正确，无新增P1/P2。任务3.3关闭，Runtime恢复code-verified；复用未变主链证据，未重复全量测试。


## 2026-10-23 配置接入跟进

用户指定参考PricePilot的API Key与模型。实际读取其当前本地配置，使用gpt-6.1-sol、显式Responses SSE与medium reasoning；Key仅写当前根ignored .env，权限0600，程序相等核对通过，不进入源码、public schema或客户端。未复制PricePilot数据库、Langfuse、搜索或研究预算；本地模型超时60秒、输出2048，避免沿用研究任务的大额度。默认example仍关闭模型，真实调用单独授权。

- 新增受信AI_MODEL_BASE_URL、AI_MODEL_RESPONSE_TRANSPORT与AI_MODEL_REASONING_EFFORT。校验凭据/query/fragment/非法地址；新Run冻结地址和传输/reasoning，当前Key不会发给不同冻结地址。旧descriptor缺少新增字段时保留原JSON/无reasoning字节。SSE只从完整终态response解析结构化结果，原始事件及usage持久化，缺终态截断unknown，不用delta拼造结果、不自动fallback或重发。
- 相邻离线`tests/test_model_adapter.py tests/test_wardrobe.py tests/test_unit.py tests/test_bootstrap.py tests/test_runtime.py`153 passed+5subtests（新增错误隐私用例随后单独验证）；原真实PG恢复/取消23 passed/0 skipped；新增真实adapter+SSE外部HTTP边界替身/PG持久化及独立禁用模型CLI恢复2 passed。各范围与前次验收重叠，不累计全Plan去重总数。
- 新增9 Python文件Ruff/format、architecture、AI OpenAPI drift、Compose YAML及AI-only新配置断言、diff PASS。首次Ruff两处import排序已定向修正，未改依赖或运行build/server。
- 配置后双服务替身回归5场景/7不变量PASS，原样收据`.tools/manager-runtime/integration-cross-service-141319060d4748d18f8e1715bb1644d8.json`；临时schema/Redis前缀清理成功。首次启动从根目录使Backend读取共享.env校验失败且错误带出密钥片段；修正临时harness工作目录并隐藏配置错误输入后复验通过，未重复输出配置值。AI Settings同样隐藏错误输入。此跟进未向模型供应商发送请求。
- 一次真实闭环入口`.tools/manager-runtime/live_wardrobe_flow.py --execute`已准备，默认仅报告ready不执行；显式gate最多1次供应商请求、请求16384bytes、输出2048tokens、60秒，不调用工具或重试，仅合成衣物、两个自建schema及真实PG/Redis；保留真实raw/usage并清理资源。按PricePilot记录费率估算约USD0.05376，非已验证账单保证。用户随后明确授权当前环境总是允许真实测试；本次在有界入口执行并保存以下真实结果，人工/宿主验收边界保留。新增配置扩展未伪称已获此前独立Reviewer结论覆盖。


### 本环境真实模型闭环结果

- 用户在本会话明确授权当前环境总是允许调用真实测试；无需重复索取已有授权，后续仍按实际任务保持次数/容量/时间边界，不启动未请求的后台任务。
- 最终真实链PASS：`.tools/manager-runtime/live-wardrobe-flow-5317393317de4bb88ed5ea343a5a25fb.json` SHA256 aac44491a72412f36e421fb3c7a0198222e3948d975bc735ff7aed5b2a0c3c44。实际配置网关返回gpt-6.1-sol（requested/returned一致），单Run/单Operation/send_count1、input4157/output74/total4231；供应商未返回可用request ID，保持null。请求13429bytes、输出上限2048、60秒；没有工具、redirect、自动重试或修复调用。
- 实际Backend→Dispatcher→AI API/Worker→网关SSE→Backend事实发布→候选替换与完整组合校验→显式Wear保存/同键重放→历史/单件次数/统计PASS。推荐本身0条穿着，显式保存及重放后仅1条；跨账户404、真实Redis退出后401通过。两个PG角色/schema真实隔离，微信交换替身、天气未请求，内部跨服务为ASGI+stdlib序列化；没有微信真机/浏览器/部署/TLS验收结论。
- 原始SSE保留`.tools/manager-runtime/live-model-raw-5317393317de4bb88ed5ea343a5a25fb.sse`，SHA670545a9c8dfca7c2883f1fe77cd45b9b5bdb666fd51e419e41ecb28ff35912e；raw与公开usage/调用引用回读匹配，summary在live-model-summary.json。真实业务7类响应实际送小程序唯一production decoder的临时Vitest probe1/1 PASS，回执live-client-decoder.json；临时test已移除，无小程序运行截图结论。
- 实际排障保留：首个准备Run被16384bytes入口预算拦下，0供应商attempt；随后2次真实调用均返回合法结构，但模型把wear_count=0标为history_reference，Backend正确以invalid_output拒绝，没有降低事实校验。第二个失败的真实output通过本地原样重放确认Unsubstantiated history。基础prompt.v1不改；新增独立版本/hash冻结的reason-evidence.v1资源明确各代码正面证据，旧descriptor缺该资源键时保持旧请求字节。新policy后第3次真实调用完成整个闭环。
- 第一次真实Run因临时raw导出器错误使用dict row的整数索引，raw未成功导出且当时测试schema已清理；保留该次Run/Operation/usage/raw_sha收据，不声称raw可回放。已修正dict row访问；后续失败和成功raw均留存，若raw未捕获则harness保留测试schema而不丢证据。另修正候选排序断言，按实际候选响应选择替换项，不假设创建顺序。
- 总计3次真实供应商attempt，usage分别3854/82、3758/90、4157/74；按PricePilot现配置费率估算费用USD0.025998，其中成功次USD0.009054，非供应商账单。没有把准备预算失败记成付费发送。失败、不确定及费用历史未伪改为成功。
- 最终相邻离线156 passed+5subtests；新增policy冻结/篡改和旧JSON字节兼容回归，SSE落盘/禁用模型独立CLI恢复与缺新字段旧descriptor真实PG3 passed（前述SSE2项重叠）；Backend新增0次历史原子不能支持正历史理由定向1 passed。新增配置/协议与policy扩展为本次自查/回归/真实接入证据，不套用此前独立Reviewer结论；单case成功不代表模型质量或所有库存条件已验收。

- 本轮最终静态与资源收尾：9 AI Python文件及1 Backend规则测试Ruff/format、架构/AI OpenAPI drift/diff PASS；22目标源码/文档定向实际Key扫描无匹配，根.env ignored/0600。仅本thread所有的55432 PG及56379 Redis按owner/PID/路径核验后干净停止，付费raw/usage、失败与费用回执保留；收尾回执live-final-cleanup.json。

## 2026-10-23 接入独立复查与 TCP 证据

- 新网关/SSE/reasoning/reason-evidence/根配置的独立只读审查 PASS，无已确认 P1/P2；核对冻结请求、旧 descriptor、当前 Key/endpoint、终态/unknown、原样usage持久化、取消和恢复，无自动重试或提示词付费修复。
- 真实模型 TCP 主业务链通过：实际 httpx → uvicorn Backend → production AiRuntimeClient → uvicorn AI API → 单 Worker → 配置网关/gpt-6.1-sol → 推荐/替换/显式保存/同键重试/历史统计。微信交换替身，未测真实微信。JSON RPC 只控制测试初始化/Worker/取证，不承载 Backend→AI HTTP。
- 本轮1次provider attempt，1 Operation/send_count=1；usage 4137 input/77 output/4214 total，按现有配置估算USD0.009044，非账单。raw SSE 28943 bytes，SHA256 `4b9cbef8a5fa7a8a50ec7fb731d185cb53f7b44a891b046238b52bba613379fb`；provider request_id 未提供则保持null。
- 原始收据 `.tools/manager-runtime/acceptance-tcp-flow-39f5eb2b03d34c79980237f8bcd4c32a.json` 整体为 FAIL：主业务 check 通过后，扩展图片检查误断言 RGB PNG 必须仍下载PNG，实际现行规范化格式为JPEG。这是 harness 断言错误，未改生产图片规则。原收据和付费raw原样保留；后续复验采用明确 ModelPort 替身，没有第二次provider调用。
- 完整TCP/私有媒体/资料城市/编辑归档/历史快照/删除墓碑/统计/授权退出复验6组不变量 PASS，69次客户端HTTP；收据 `.tools/manager-runtime/acceptance-tcp-offline-flow-a610921fb214478fb56dc78412772e98.json`。其中19/7 usage与raw为合成证据，不算真实模型；原transport标签继承错误已在 `acceptance-evidence-annotations.json` 纠正，未重写原始收据。两组证据均经独立只读复核。
- 本轮新建schema、私有Redis前缀和媒体目录已精确清理，TCP listeners退出；仅本任务PG/Redis经数据路径/PID/进程核对后停止。一个没有本轮创建证据的已有schema保留，不宣称清空数据库。当前无后台模型调用。
