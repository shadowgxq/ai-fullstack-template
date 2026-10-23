# Backend

保留同步 FastAPI → service → repository → model 基座，SQLAlchemy 2、Alembic、PostgreSQL、Redis、JWT/bcrypt 认证。

Python 3.12、uv；先在仓库根执行 `make infra`，然后在本目录：

```bash
uv sync --locked
cp .env.example .env
make upgrade
make dev
```

已有初始 users 迁移，首次启动仅升级，不重复生成初始迁移。API 8000，OpenAPI `/docs`，存活 `/health`，依赖和表就绪 `/ready`。

```bash
make check                 # 只读 lint、format check、pytest
make format                # 显式格式修复
make migrate m="add field" # 新表结构才生成迁移，审查后 upgrade
make upgrade
```

环境变量：`DATABASE_URL`、`SECRET_KEY` 必填，`REDIS_URL` 默认本地；示例与根 Compose 的 backend 数据库一致。禁止使用 AI 数据库凭证。容器启动不执行迁移；根 Compose 单独运行 backend-migrate。

现有单测使用 SQLite/FakeRedis，不代表真实基础设施验证；根 `make up && make smoke` 验证 PostgreSQL 迁移、注册/登录、Redis token 撤销。可选缓存故障可回源；认证/限流/撤销依赖故障返回 503，不能伪报登出成功。开发基座仍不等于完整生产安全方案。

细则见 [专项导航](../docs/engineering/backend/README.md)，业务与跨端契约统一在根 docs。

## 微信账户

`POST /api/v1/auth/wechat` 接受临时 `{code}`，服务端使用 `WECHAT_APP_ID`、`WECHAT_APP_SECRET` 交换身份，返回 Bearer 凭据与本人 `user`。交换超时由 `WECHAT_TIMEOUT_SECONDS` 控制（默认 5 秒），不自动重放一次性 code；未配置凭据返回 503。Secret 和微信 session_key 不返回客户端、不进入日志。`GET /api/v1/profile` 经同一 Bearer 身份仅查询本人可选资料与version；空昵称由客户端展示“衣柜用户”。

`PATCH /api/v1/profile` 带 `expected_version` 保存可选昵称/头像/可信city_id，旧版本409；未提交字段保持、null清空，昵称trim后最多80字符，头像仅接受本人ready的avatar媒体，城市仅接受冻结目录中的地区。资料、版本与引用同事务提交，沿账户→资料→媒体锁序与后台清理协调；替换后旧媒体按未引用保留期清理。接口不接收时区、手机号或owner。迁移为已有资料回填version=1并保留昵称/头像/城市原值，具体字段和错误契约见[跨端契约](../docs/contracts/README.md)。

原生运行在 `backend/` 下读取 `backend/.env`（模板为本目录 `.env.example`）；根 Compose 从根 `.env` 或启动环境读取微信配置后注入 Backend 容器。两种方式均由 Backend Settings 校验，空字符串或纯空白的 AppID/Secret 视为未配置，应用仍可启动，微信登录返回受控 503；非空凭据保留原值。只填写所用运行方式的对应配置，勿放进客户端环境变量。

迁移保留旧密码账户，将密码 hash 改为可空并回填默认 profile；微信账户无密码，原密码接口继续可用。该迁移仅支持前向升级，不能用降级删表或填充伪密码回退账户事实；实际回退须另有保留数据的方案。微信 AppID、合法域名和端上权限仍需实际接入核验。

## 长期穿搭偏好

`GET/PUT /api/v1/preferences` 使用本人 Bearer 身份，六组喜欢/避免选项复用衣物目录，舒适度作为可选文本保存。缺行GET返回version0且不写库；完整PUT携带expected_version，版本冲突409，目录未知项或同项喜欢/避免冲突422。偏好、版本及preferences_revision同事务，失败回滚；迁移为既有账户补preferences_revision=0，保留原资料、库存和历史。字段与边界见[跨端契约](../docs/contracts/README.md#长期穿搭偏好)。

## 城市与天气

本人Bearer身份访问 `GET /api/v1/cities` 和 `POST /api/v1/weather/context`；搜索可信版本目录、选择城市或主动提交GCJ-02模糊定位，形成仅本人可消费的当日天气上下文。空选择使用有效已存城市，否则明确默认杭州。城市写入复用profile版本；天气失败可返回missing context，不回退覆盖有效城市，不阻塞衣柜与历史。接口字段与错误见[跨端契约](../docs/contracts/README.md#城市与天气)。

固定中国天气网页面只解析经地区/日期核验的事实，当前解析器保守提供有证据的当日时段预报；没有观测或明确高低温证据时保留null。显示源时间与抓取时间，不称实时天气。共享Redis日缓存按北京时间失效、保留7个自然日；认证/撤销依赖仍fail-closed，天气HTTP不进入业务事务。

可选 `TENCENT_MAP_KEY` 仅由Backend用于逆地址解析，空值不影响核心启动，主动定位返回受控503。原生运行在 `backend/.env` 配置；根Compose从根 `.env` 或启动环境注入Backend，不将Key放入 `TARO_APP_*`。`WEATHER_TIMEOUT_SECONDS` 默认5、范围(0,15]秒；`WEATHER_MAX_BYTES` 默认524288、范围1024–3145728。请求固定HTTPS端点、限制正文且不跟随重定向，不记录密钥、坐标或供应商错误原文。

冻结目录位于 `app/assets/weather/regions.v1.json`，迁移使用同一版本资产；来源元数据与哈希可复核，代表可信天气目录交集，不代表完整最新行政区划。更新目录须重新核对来源、生成新版本及迁移，不能直接改写既有版本文件。现有冻结输入可离线复算：

```bash
uv run --locked python scripts/freeze_weather_regions.py --sources tests/fixtures/weather --out /tmp/wardrobe-regions-review.json
```

该命令只读冻结来源并写指定输出，不访问网络或业务库。生产来源使用条件、腾讯地图权限/额度与微信模糊定位仍需接入核验，隔离测试不代表真实宿主已通过。

## 私人衣柜与媒体

本人 Bearer 身份访问 `/api/v1/wardrobe/options` 与 `/api/v1/garments`。创建必须携带 1–128 位非空白可打印 ASCII `Idempotency-Key`，同键同规范输入返回不可变 `{id,version}` 收据，不同输入返回 409。编辑使用 PATCH 和 `expected_version`；缺失字段不变，可空字段 null 清除、多选 [] 清除。衣物和库存 revision 同事务提交，账户创建时初始化 revision，迁移回填已有账户。

`POST /api/v1/media` 接收认证 multipart `file/purpose`（garment/avatar）与幂等键，实际解码 JPEG/PNG/WebP 并移除 EXIF；原始图片最多 10 MiB、2500 万像素、单边 8192px，环境配置可收紧上限。`GET /api/v1/media/{id}/content` 每次校验本人身份，不提供公开 URL。`MEDIA_ROOT` 默认 `var/media`，必须在公开静态目录之外持久保存；部署须同时核验数据库与媒体卷备份，多实例必须共享该目录。上传中断保留 pending，可用同键同文件恢复；已清理媒体保留墓碑且不能复活。

后台清理命令 `uv run --locked python -m app.services.media_cleanup --batch-size 100` 每次有界扫描超过 24 小时且未被衣物/头像引用的 ready/pending 媒体，并重试 deleting。它先在账户锁内确认引用与标记，再在事务外删除文件，最后保留 deleted 墓碑；部署应由受控调度器定期调用。不要直接删除目录、数据库行或幂等墓碑。

## 实际穿着记录

`/api/v1/wear-records` 仅处理本人主动保存的事实。POST 接收 ISO 日期 `wear_date` 与非空 `garment_ids`（最多 1000 个输入 ID），以同一 `Idempotency-Key` 保存重试；ID 去重排序。手动记录允许本人三种状态衣物；可选 `recommendation_request_id` 则在同一保存事务内重验本人推荐、完整组合、可穿状态、硬约束、revision 与所用天气时效，不能静默降级为手动。原幂等收据优先于来源失效检查；无来源的旧手动收据仍使用原规范 hash。日期按服务端 `Asia/Shanghai` 判断，允许过去及当天，同日可保存多套，不接受客户端时区。

列表支持包含边界的 `start_date/end_date` 与签名游标，按 `(wear_date,id)` 降序，每页默认 20、最多 100 条。详情返回保存时名称/类别快照；PATCH 必须带 `expected_version`，日期/集合缺失保持原值，null 与空集合被拒绝。修改保留既有项旧快照，新增项读取当前属性。DELETE 必须携带 `expected_version` query，返回 `{id,deleted:true}`，同次删除重试不重复增 revision；保留创建收据及删除墓碑，旧 POST 返回 409 且不复活记录。

记录、快照、收据、墓碑与 `history_revision` 在账户锁内同事务修改，库存 revision 不受影响。`GET /api/v1/garments/{id}` 的 `GarmentDetail.wear_count` 聚合当前有效记录，归档不清零；衣物 PATCH 仍返回基础实体。历史不保存照片副本，当前私有图片继续遵守媒体授权和清理规则。内部有日期范围的历史摘要供后续推荐消费，不提供公开摘要接口。

## 穿搭推荐

本人访问 `POST/GET /api/v1/recommendations` 与资源下的 `cancel`、`replacement-candidates`、`validate-selection`。创建接收 `scene`（any/work/daily/date）与可选本人有效天气 context，并携带稳定 `Idempotency-Key`；同键同内容返回原请求及冻结依据，同键异内容409。无库存和无合规候选分别以正常 ready outcome 返回，不投递 AI。完整字段见[唯一契约](../docs/contracts/README.md)。

创建先检查全部本人可穿库存的明确风格标签、颜色、场合与结构化避免项；对应属性未知时不能证明无冲突，保守排除。全部合规库存确定性排序后，本次模型输入最多16件，公开合规数量与容量限制。只冻结候选近30个上海自然日已记录历史，不将全历史穿着次数当作近期次数；部分天气保留缺失温度。舒适度文本仅供 AI 参考，不进入硬过滤或匹配保证。

请求与 Outbox 同事务保存。投递为显式命令，应用 import/启动不自动投递：

```bash
uv run --locked python recommendation_dispatcher.py --limit 1
```

`--limit` 为1–100，每次命令认领采用30秒 lease，事务外执行一次有界 HTTP，再按 lease 身份回写。业务请求5分钟截止，迟到结果不能复活；网络失败按有上限的退避重投同一 `wardrobe:{request_id}` 身份。取消/超时清理意图继续持久恢复；未知 Run ID 时使用 Runtime 的 cancel-by-key 原子墓碑，避免为找回而创建新 queued 调用。部署需用受控调度器定期执行 dispatcher。

`AI_SERVICE_BASE_URL` 仅接受受信 http/https origin，`AI_SERVICE_API_KEY` 仅供 Backend；默认均为空。`AI_SERVICE_TIMEOUT_SECONDS` 默认5秒、最大15秒；`AI_SERVICE_MAX_RESPONSE_BYTES` 默认及最大1048576。缺配置不阻塞核心启动，投递返回受控失败；不能把服务凭证放进小程序变量。取消/查询也不持业务数据库事务，不直接访问 AI 数据库或导入其包。

发布、ready 读取、替换及确认重验本人归属、状态、硬约束、三类 revision 和实际使用天气的有效期，变化显示 stale。模型 ID、代码或事实语义非法时以 invalid_output 失败，不付费修复；中文理由与限制由受控事实重建，不展示模型自由文本。替换候选签名游标绑定本人、请求、revision 与排除集合，不强制同类别；完整组合校验不调用模型、不写历史。只有共用穿着 API 的显式保存产生事实；历史后续编辑/删除保留原快照规则，不重新执行旧推荐。

## 衣柜与穿着统计

`GET /api/v1/statistics` 经本人 Bearer 身份，以单个 SQL statement 同快照读取库存、类别、全量有效记录次数、单件次数、近 30 日趋势及库存/历史 revision。可穿与暂不可穿计入 `wardrobe_total`，归档另计，类别按当前未归档衣物统计，null 表示未分类。全量次数不被趋势窗口截断；趋势覆盖 `Asia/Shanghai` 今天及此前 29 日，返回明确起止日并补齐零值。归档不清零已记录次数，不以零次推断用户从未穿过。

`garment_counts` 包含本人全部状态及零次衣物，名称/类别为当前值，按次数降序、UUID 降序分页。`page_size` 默认 20、上限 100，`garment_cursor` 绑定 owner、统计日和两类 revision；非法或跨账号游标返回 422，事实变化或跨北京时间午夜返回 409，客户端应重新载入第一页。接口不维护长期服务器快照，不新增计数表或异步累计任务。
