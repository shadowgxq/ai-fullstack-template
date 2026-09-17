# CompanyLens 系统接入详细设计

> 版本：1.0｜日期：2026-09-16｜状态：待实施设计。  
> 责任：补充系统架构中的数据、事务、DTO、事件与部署机制；不替换两份v1.1中的财务方法或运行原则。  
> 本文是系统架构的支持输入，不独立扩大P0产品范围。SQL/流程为设计示例，不是已应用的迁移或可直接上线的完整代码。

## 0. 共享合同与适用性

### 0.1 所有消费者均遵守

一个仓库、两个应用目录、一个Python包；同一业务只保留一套运行/调用/预算/计算事实源。API与Worker同包不同进程；前端保留CSS Modules/Radix及现有交互。请求scope由受信宿主注入。金额/比率经Decimal处理，对外为十进制字符串；未知null附reason，不填零。时间带时区，as_of只在首次创建冻结。

运行状态、研究质量、命令投递、外部交换及取消意图分开。图恢复读取原版本；报表/公式/来源变化生成新不可变产物。已有合法Delivery是正式结果的入口；同scope不意味着可读取一切内部artifact。

下文新增列名、DTO投影、控制事务、事件算法和配置均为本轮工程细化。字段可在实现阶段按实际框架调整，但不能改变可观察行为；修改公共字段时同步OpenAPI/事件schema及客户端。不要因为本文给出7类逻辑表，就为每个业务对象生成一张表。

### 0.2 设计机制与状态投影约定

`run_version` 是应用公开投影/控制记录的乐观并发版本，`last_event_sequence` 是本Run的已提交事件高水位；二者不可互换为checkpoint ID。对command的expected_run_version在受理时做乐观校验；执行时依据命令身份、当前执行状态和具体中断版本检查是否已应用/仍适用，不因普通进度更新就把已合法接受的命令永久丢弃。

`checkpoint_id`只供恢复/回答版本校验，不把Saver内部任务对象直接返回浏览器。`accepted_response_ref`是完整原始响应的受控内部引用；公开结果按专门投影序列化。

以下为设计规则，不声明新的支持输入。本文涉及的路径是实现落点或既有依据，不据此递归生成Manager任务/输入。

## 1. 应用数据与约束

### 1.1 逻辑字段与索引

| 表 | 必要字段组 | 约束/索引 | 主要写入者 |
|---|---|---|---|
| runs | run_id、scope_id、request_id/hash、thread_id；frozen_input/manifest/budget；execution_status、phase、result_quality；run_version、last_event_sequence；cancel_requested_at/reason、delivery_ref、created/updated_at | PK run_id；UNIQUE(scope_id,request_id)、thread_id；列表(scope_id,created_at,run_id)；状态过滤按实际查询加索引 | 创建/控制服务及Runner投影 |
| run_commands | command_id、run_id、command_kind、command_key、payload/payload_ref、expected_run_version；dispatch_status、available_at、claimed_by/at、handled_at、diagnostic | PK command_id；UNIQUE(run_id,command_kind,command_key)；pending+available_at索引；FK run | Dispatcher/应用事务 |
| operations | operation_id、run/task/task_attempt/node、exchange_seq、payload_hash、adapter_version；status、accepted_response_ref、created_at | PK operation_id；同身份payload不可变；按run/status索引 | 受控调用入口 |
| operation_attempts | attempt_id、operation_id、transport_status；reserved_budget、known_usage/cost、cost_status；provider_request_id、started/finished_at | PK attempt_id；FK operation；预留在单行按budget_kind保存/原子更新，禁止重复预留 | 台账/预算服务 |
| artifacts | artifact_id、scope_id、created_by_run、kind/schema_version；content_hash、body_inline或storage_key、size/mime；input_refs/hashes、access_class、created_at | PK artifact_id；内容字段二选一；依赖必须可解析；不公开跨scope的hash去重是否命中 | 产物服务 |
| run_events | event_id、run_id、sequence、type/schema_version、occurred_at、safe_payload | PK event_id；UNIQUE(run_id,sequence)；按run+sequence范围查询 | 应用关键转换事务 |
| human_responses | answer_id、run_id、interrupt_id、question_version、expected_checkpoint_id、answer_hash/body、actor、status pending/applied、applied_checkpoint_ref | PK answer_id；UNIQUE(run_id,interrupt_id,question_version)；重复同答原样返回，异答冲突 | 回答服务/Runner对账 |

数值主键格式使用统一约定，例如UUID；序号/版本用足够范围整数。冻结schema版本必须校验，不允许JSONB成为未校验任意对象入口。完整DDL由实现change产生并由迁移测试确认，不手工修改Saver内置表。

### 1.2 为什么不只用先查后写

并发请求可能同时查不到同一幂等键，所以创建依赖数据库唯一约束；冲突分支重新查询已提交记录并比对request_hash。跨scope相同request_id不得串用结果。受理事务回滚时Run、命令和accepted事件一起回滚。

同一operation反复进入先查正式响应；没有响应但已有in_flight attempt时不是“再创建一条新attempt就重试”。只有明确未发送或已有风险授权才进入恢复政策。自动生成新的随机operation来躲开唯一约束会破坏账务语义。

### 1.3 存储对象

小型原始响应和小JSON产物可在DB的artifact行内保存；建议inline阈值256 KiB，超出走受控内容存储，具体限额需实际测试。大内容对象写入顺序：临时文件 → 完整性/hash检查 → 数据持久化 → 同文件系统原子rename → 目录持久化 → DB元数据与引用事务。

文件storage_key由服务生成，例如`<scope_namespace>/<hash_prefix>/<content_hash>`；不接受用户路径。所有路径规范化并拒绝越界/符号链接绕过。API映射同一根目录且只读，响应不泄露宿主真实路径。大响应存储成功但DB事务失败形成孤儿，后续按hash复用或清理；DB必须再次确认权限和正式引用资格。

## 2. 事务与恢复协议

### 2.1 创建请求

```text
authorize actor → trusted scope
validate public request (no scope/provider endpoint injected by client)
canonicalize request BEFORE server clock defaults → request_hash
BEGIN
  insert Run under UNIQUE(scope, request_id)
  if duplicate: compare request_hash; return original or conflict
  freeze server as_of, approved config/resources and finite budgets
  insert initial advance command with stable command_key
  append accepted event and public snapshot version
COMMIT
return accepted receipt
```

事务应答不明时，在新连接上查询同scope/request_id。不能对同一用户操作换key，更不能补一个新的as_of然后误判“内容不同”。请求规范化策略保存版本，参数顺序和等价缺省表达不能随代码升级悄悄改变历史键含义。

### 2.2 命令领取和执行

下面是领取模式示例，表/字段名随实际迁移校验，不是完整队列实现：

```sql
BEGIN;
WITH candidate AS (
  SELECT command_id
  FROM run_commands
  WHERE dispatch_status = 'pending' AND available_at <= now()
  ORDER BY available_at, command_id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE run_commands AS cmd
SET dispatch_status = 'claimed', claimed_by = :worker_id, claimed_at = now()
FROM candidate
WHERE cmd.command_id = candidate.command_id
RETURNING cmd.*;
COMMIT;
```

`SKIP LOCKED`只用于领取队列式工作，不用于返回完整一致的用户历史；它不提供远端幂等或自动接管。[系统架构来源W09]

领取后用专用连接取得该run的session advisory lock，再读最新状态与manifest。成功持锁才推进。重复命令若已消费/Run已终态，登记handled而不再次执行；不适用回答记录rejected及原因，不能静默删除用户已受理的回答。

网络和图运行不在领取事务中。图停在interrupt时，当前推进命令可以handled，Run仍interrupted；释放执行槽让其他Run处理。Worker崩溃后，先由监督进程/维护者确认旧执行者停止，再恢复claimed命令，不能把心跳晚到直接当作可并行接管。未来多Worker方案需要另外验证claim、fencing与旧写者隔离。

数据库锁固定顺序：需要时先取得run advisory锁，再在短事务中按Run控制行 → operation/attempt → command/answer/事件的顺序访问；取消不取advisory锁但遵循控制行序列化。多行更新按稳定ID排序，降低死锁。死锁/提交未知仍按是否已发送外部请求分类，不通用盲重试。

### 2.3 外部请求与预算

```text
prepare node: freeze ExchangeSpec + stable operation_id → sync checkpoint
execute node:
  existing complete response? return response_ref
  unresolved possible-send attempt? reconcile / unknown policy; do not send
  short transaction:
    lock Run control/budget record
    check current authorization, cancel flag, deadline, remaining limits
    create attempt + reserve + in_flight
  commit request admission
  invoke adapter ONCE outside transaction
  persist full raw response (inline or immutable content)
  short transaction:
    accept response if same frozen exchange and current accepted slot empty
    record known usage; keep remaining unknown amount held
    store operation response_ref
  return response_ref → graph writes checkpoint
```

对同一operation收到内容相同重复响应可以幂等接受；冲突内容进入隔离，不能覆盖原正式响应。取消后返回的数据仍可进入内部台账，业务采纳和正式发布另行检查。客户端timeout或取消await不证明供应商未执行。

只有能够证明未发送的传输失败可沿原exchange增加有限attempt；收到明确可重试错误或经授权重发，按政策创建新exchange并计账。HTTP200中的工具错误是已保存失败响应，不能作为成功缓存循环读取。

### 2.4 回答、取消和发布

回答受理用短事务校验当前interrupt和版本，写pending与resume command。重复answer_id同内容先返回原受理状态，避免原回答已消费后被误判过期。首次不同回答必须针对仍等待的问题。消费后checkpoint记录answer_id；恢复对账顺序先看原问题是否仍在、是否已消费，再补写applied，绝不向后续无关节点再次resume。

取消受理在Run行锁内读取当前终态：终态原样返回；空闲可取消态直接cancelled；运行中登记cancel_requested，不等待advisory锁。每次请求准入在同一Run行锁下检查取消，从而给“新调用是否允许”一个可复验的顺序。已准入但尚未真正发出时发现取消可安全放弃；不能因为本地尚未收到响应就认定未发出。

发布伪协议：

```text
load immutable candidate + audit + lineage and verify exact hashes
BEGIN
  lock Run control row
  if existing valid delivery: return same delivery
  if cancelled / cancel_requested: refuse publication
  verify permitted execution state, current accepted lineage and audit policy
  insert immutable DeliveryManifest under deterministic delivery identity
  set runs.delivery_ref, result_quality, execution_status=completed
  append run_finished event and increment public snapshot version
COMMIT
graph returns delivery_ref and ends
```

graph终态checkpoint稍后失败不会取消已经合法发布的Delivery。Worker恢复时补齐终止引用；GET只读已发布结果。只有此发布事务能设置正常completed；普通节点结束/消息流停止不能绕过它。

### 2.5 对账判定顺序

1. 先查Run当前授权、取消/终态和正式Delivery；已终态不再发送业务请求。
2. 查当前图与冻结版本；缺失但从未开始时用冻结输入，版本不兼容则阻断。
3. 查已准备交换和operation记录；完整响应复用，in_flight未有完整响应视情况unknown。
4. 查当前interrupt与pending/consumed回答；补状态或继续原回答。
5. 只重建可由已持久化事实推导的公开投影/事件，不能用猜测补源数据或费用。

同一个运行的对账在排他推进保护内完成，API只读可展示`recovery_required`诊断字段，但它不是新增执行终态。队列、图、台账和公开快照各自责任不合并为一份模糊JSON。

## 3. HTTP 与 DTO 合同

### 3.1 创建请求与回执示例

以下均为合成示例，不是真实上市公司、股票数据或已运行结果。

```json
{
  "company_query": "示例公司",
  "market_hint": "CN_A",
  "mode": "standard",
  "profile": "standard_p0",
  "time_mode": "current"
}
```

`Idempotency-Key`为同scope内请求键；可兼容body.request_id但两者同时提供必须一致。company_query去除首尾无意义空白，建议长度1–200字符；未知字段按公开schema拒绝或明确兼容政策，不能偷偷接收scope/provider/policy任意路径。current的as_of服务端生成，客户端不能传任意过去时间启用未开放能力。

```json
{
  "run_id": "00000000-0000-4000-8000-000000000001",
  "execution_status": "created",
  "request_id": "client-action-001",
  "links": {
    "snapshot": "/api/v1/runs/00000000-0000-4000-8000-000000000001",
    "result": "/api/v1/research/runs/00000000-0000-4000-8000-000000000001/result"
  }
}
```

首次创建202；重放同请求可返回200及原Run当前状态，用`idempotent_replay`字段表示重放。不能每次重试都把已完成Run伪装成created。创建接口不等待模型结果。

### 3.2 RunSnapshot公开字段

| 字段 | 语义 |
|---|---|
| run_id / mode / profile / execution_mode | 当前任务及研究/测试范围；execution_mode由可信配置决定 |
| execution_status / result_quality | 两个独立字段；无正式研究质量时null |
| phase / safe_summary / progress_observed_at | 公开阶段和最近已确认进度；不是内部推理 |
| cancel_requested / snapshot_version / last_event_sequence | 取消意图、投影版本、已提交事件高水位 |
| company_summary / as_of / created_at | 已核实才有主体摘要，原查询可另列 |
| interruption | 可回答问题、候选、question_version、interrupt_id、expected_checkpoint_id；无内部敏感信息 |
| allowed_actions | 例如can_cancel/can_continue/can_answer/can_revise及拒绝原因，最终仍由服务器鉴权 |
| budget_summary | 已知、估算、held_unknown及剩余可用额度口径，未知不能填0 |
| delivery_ref / result_link | 仅合法已发布产物的引用 |
| diagnostics | 安全错误码、是否可恢复及建议动作，不含堆栈/密钥 |

并非把该表所有字段第一天做成完整监控台；正式能力使用到的字段必须有上述语义。缓存按scope/run键隔离，返回`Cache-Control: private, no-store`作为私有状态/结果的默认策略；后续缓存优化另作验证。

### 3.3 统一错误

```json
{
  "error": {
    "code": "request_conflict",
    "message": "此请求键已用于不同的研究内容。",
    "request_id": "http-request-001",
    "retryable": false,
    "details": {"field": "Idempotency-Key"}
  }
}
```

| HTTP | 例子 | 客户端行为 |
|---|---|---|
| 401 | authentication_required | 进入现有认证流程；不能重放有歧义的收费mutation |
| 404 | resource_not_found | 无权与不存在保持同一公开响应，不泄露owner |
| 409 | request_conflict、stale_answer、result_not_ready、run_not_resumable、cursor_expired | 读取最新状态或用户修正；不盲重发新Run |
| 422 | invalid_request、profile_not_enabled、historical_not_enabled | 显示明确字段/能力限制 |
| 429 | scope_limit、queue_limit、request_rate_limit | 遵循Retry-After或明确重试提示；保持原请求键 |
| 503 | database_unavailable、storage_unavailable、service_not_ready | 显示系统故障；原提交结果未知时复用原键对账 |
| 500 | internal_error | 保留安全关联ID，内部记录诊断，不冒充partial |

后台研究发现资料不足不会把已接受请求的原HTTP回执改写；它产生后续Run状态/合法partial或blocked交付。不要混用HTTP请求错误与研究内容质量。

### 3.4 正式结果与产物视图

Result包含profile/as_of、result_quality、身份/范围摘要、结构化section/metric/calculation/claim的公开引用、gaps/conflicts、audit_summary和delivery_id。report不支持时report_ref为null并给理由。Decimal值保留机器值、unit/currency/display_precision与服务端显示文本。

通用artifact读取不是任意文件下载：

| access_class | 普通研究用户读取规则 |
|---|---|
| internal | 原模型响应、opaque、冻结密钥引用、运行控制资料：拒绝 |
| candidate | 未通过审计的候选报告：拒绝作为正式结果读取 |
| evidence_view | 受scope与来源展示许可约束，只返回允许片段/定位/结构化观测 |
| calculation_view | 返回具名公式、输入引用、结果与不适用说明；不执行任意表达式 |
| published | 仅正式Delivery引用的可交付报告/元数据 |

访问通过artifact_id查元数据后重新验证run/scope/引用资格；不允许客户端传storage_key直接访问文件。禁止HTML原文脚本执行；原文件如允许下载，用正确Content-Type/Content-Disposition与内容安全策略，不能作为同源可执行页面直接嵌入。

## 4. 事件与快照算法

### 4.1 事件信封

```json
{
  "schema_version": "1",
  "event_id": "00000000-0000-4000-8000-000000000042",
  "run_id": "00000000-0000-4000-8000-000000000001",
  "sequence": 42,
  "event_type": "phase_changed",
  "occurred_at": "2026-09-16T09:00:00Z",
  "payload": {"phase": "verifying", "summary": "正在核验财务口径"}
}
```

```text
id: 42
event: phase_changed
data: {"schema_version":"1","run_id":"…","sequence":42,"payload":{"phase":"verifying"}}

```

常用事件沿核心定义：run_started、phase_changed、human_input_required、operation_unknown、completion_evaluated、run_finished；可以增加cancel_requested等明确事件。事件白名单公开投影；不把供应商token/内部trace直接透传。

### 4.2 事务性序号

```text
BEGIN
  lock runs row FOR UPDATE
  if event_id already recorded: return original sequence (no increment)
  apply same public projection update
  next_sequence = last_event_sequence + 1
  insert event with next_sequence
  update last_event_sequence and snapshot_version
COMMIT
```

事件ID由业务事实身份确定，如操作/回答/交付ID与事件类型组合，重放同一已登记事实复用ID。不能仅按毫秒时间或进程内计数器去重。

不要用与事务提交无关的全局sequence作为完整读取高水位：事务A先取41但未提交，B先提交42，客户端游标已到42后可能永远跳过后来才提交的41。本设计用同Run行序列化关键公开转换。行锁只覆盖短事务，不覆盖模型调用或SSE监听。

### 4.3 重连与保留

Snapshot读取使用一个一致事务视图，返回已提交投影与其高水位S。随后拉取events sequence>S，按sequence排序。重复允许，客户端去重并以正式快照校准；消费顺序不靠到达时间猜。相同sequence不同内容属于协议/数据异常，记录并重新校准，不能默默覆盖。

SSE连接在开始前完成鉴权和游标合法性检查；事件已清理时可在流打开前以409错误响应要求重取快照。流内发生授权失效或资源问题时发送可解析的安全控制消息并关闭；浏览器不得无限无鉴权重连。若游标大于当前最高序号且不对应有效历史，返回cursor_invalid并校准。

定期无业务数据时发送SSE注释保活；不是run_events新业务行。反向代理关闭该路径缓冲，空闲超时大于保活间隔。非GET动作使用同源受保护会话/CSRF策略；自定义Authorization头需求使用受控fetch流，不能把长期token塞进URL。断开连接只关闭监听，不写cancel。

## 5. 前端迁移与访问控制

### 5.1 接入层责任

实施时建立一张实际盘点表：既有路由、页面组件、DTO、请求函数、缓存key、mock来源、认证hook及受影响状态。表内必须来自当前代码，不用推荐目录猜测。

```text
既有页面 / Radix + CSS Modules组件
  → 既有feature hook或新轻量接入hook
  → DTO到view model的纯映射
  → 统一请求客户端 / 生成API类型
  → 新Run API
```

映射只调整字段名、空值展示和时间格式等视图表达；金融运算与发布判断留在后端。生成字段不足时修改公共schema和服务端投影，不在浏览器用推测补数据。

服务端状态留在统一查询缓存；抽屉开关等局部交互留本地。既有Zustand/其他store如存在不强制移除，但不能再保留互相矛盾的第二份Run“真状态”。退出/切换身份使相关缓存失效，清理事件连接。

### 5.2 必测状态矩阵

创建：空输入、歧义、提交中、202、重试同键、409、429、系统故障。运行：created/running/interrupted、cancel_requested、failed_retryable/terminal、cancelled。结果：complete/partial/blocked、未交付、缺失/零值/不适用、引用不可展示/可展示、来源冲突。

UI只暴露已开放profile；不把完整模式按钮做成“先收费后回退standard”。已保留页面如果旧交互要求立即生成结果，改为“接受→进度→结果”的必要行为差异要说明并局部适配，不以保留旧交互为由伪造后端实时完成。

### 5.3 认证和出站安全

受限试用的具体认证产品待定，但验证合同不待定：可信subject→scope映射、API不可绕过身份入口、撤销生效、逐资源授权、改变状态的CSRF/Origin保护。仅检查前端是否登录或网关是否有密码不等于跨用户资源隔离。

DocumentReader仅允许登记策略内的HTTP(S)目标，拒绝危险IP范围/用户信息URL/不允许scheme；连接前解析并验证全部目标IP，重定向逐跳校验并限制跳数。验证地址与实际连接地址必须绑定，避免“检查一次DNS、连接时又解析到内网”；可信网络出口限制作为第二道防护，不能仅用字符串域名黑名单。

解析器处理有界bytes而非任意URL，禁脚本/宏与任意子进程，限制CPU/内存/页数/解压大小；需要进程隔离的PDF解析不变成另一个业务服务。来源敏感信息进入模型前按数据政策筛选，不能认为“公开可见”就允许无限复制外发。

## 6. 启动、存储与升级协议

### 6.1 环境合同（不是已生成的Compose）

API与Worker读取同一版本镜像/代码和公共配置，但凭证按用途最小化。API无需模型密钥；Worker持模型/资料读取凭证。文件存储两端逻辑根一致：API RO，Worker RW，数据库保留不含宿主绝对路径的storage_key。

变量分组建议：

| 分组 | 必需内容 |
|---|---|
| 应用 | environment、release_id、public_origin、enabled_profiles |
| 数据库 | 受控连接字符串、应用/Saver迁移版本、池大小/超时；advisory锁专用直连配置 |
| 内容 | artifact_root、对象大小限制、水位保护、保留政策版本 |
| 执行 | execution_mode、worker_instance_id、max_active_runs、queue/scope limits |
| 外部 | provider/model/adapter/capability标识、密钥引用、域名/速率/超时政策 |
| 预算 | max_requests/output_tokens、deadline/active limit、soft cost_limit、计价版本、unknown_replay_policy、delivery_reserve |
| 安全 | local fixed scope或可信认证配置、Origin/CSRF策略、数据外发政策 |
| 观测 | noop/langfuse、脱敏政策、有限flush timeout |

`.env.example`只能列变量与安全空值；真实密钥不入git、文档、manifest正文或浏览器。无live必需配置时静态失败；本地fake允许无真实模型密钥，不得因此在生产绕过校验。

### 6.2 启动与健康

应用迁移与Saver setup分开执行并记录版本，但受同一发布程序管理。实际Saver连接/事务/autocommit要求依锁定包文档测试，不复制自创DDL来兼容。API构建OpenAPI时不应因模块import触发迁移、连网或付费调用。

API liveness、readiness与Worker状态分别返回安全摘要。Worker的执行者身份/最近心跳用于运维定位，心跳超时不是强制接管授权。关停时先停止领取，再在有界时间内排空/保存；强制结束后必须走原恢复协议。

### 6.3 备份闭合性

一份可验收备份至少含：应用数据、Saver数据、被引用正文集合、冻结资源、schema/图/锁文件版本、各对象hash清单、恢复说明和必要的独立密钥备份引用。备份内容不能放在同一损坏磁盘上作为唯一副本。

恢复样本至少包括一份完整报告、一份partial、一个待回答Run、一个response_stored未checkpoint Run和一个unknown Run。各自按对应行为验收，不只验证“数据库启动成功”。禁止在恢复演练中自动发真实模型请求。

### 6.4 演进触发条件

API/Worker分机→共享对象存储及访问/一致备份验证先行；多个Worker→领取归属、fencing、共享限额和旧执行者隔离先行；证据定位召回不足→评估FTS/向量检索，不先引入独立RAG；公开报告SEO需求→评估静态发布/SSR，不再创建第二个研究后端。

任何扩展仍通过原scope、台账、预算、版本和交付门禁。迁移兼容记录须说明旧Run如何读、谁可继续、何时必须新Run；不把依赖更新解释成可以重写旧结果。

## 7. 故障注入与验收接缝

| 测试接缝 | 注入位置 | 需要记录的证据 |
|---|---|---|
| transaction barrier | 创建提交前/后、响应提交前/后、发布提交前/后 | 持久行数、唯一键、公开状态和响应引用 |
| fake provider counter | 请求接收处记录operation/attempt | 恢复前后实际发送次数；unknown是否被盲重发 |
| checkpoint barrier | prepare之后、response_ref之前、consume answer之后 | thread/checkpoint、冻结交换和consumed_answer_id |
| cancellation barrier | 请求准入前/后、正式publish前/后 | 控制事务顺序、是否准入、是否发布、迟到用量 |
| storage fault | 临时写失败、rename后DB失败、目录不可读/hash破坏 | 不存在悬空正式引用；孤儿可识别而非当证据 |
| SSE transport | 快照/订阅间写入、重复、游标过期、未提交事件 | 页面最终快照、sequence、Run数量不变 |
| authorization corpus | 伪造scope/身份头、跨scope ID、内部artifact、重定向内网 | 统一安全错误，无内容/密钥泄露 |
| version fixture | 旧manifest/不同图/新schema | 兼容或明确拒绝，无静默新模型/新日期 |

单元测试使用合成数字/固定时间；持久化与恢复使用真实测试PostgreSQL和受控内容目录；浏览器端用实际契约/MSW和必要端到端测试；live验证单独声明授权与成本。不得把“用mock返回成功”作为数据库/重启测试。

每个OpenSpec变更的verification记录实际命令、退出码、测试环境/版本、哪些场景运行、哪些未运行以及数据证据位置。这里只定义验收接缝，不为尚未实现的项目提供虚构可运行命令。
