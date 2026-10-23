# 城市与天气｜检查证据

当前 code-verified。Backend及客户端必要代码检查、原样HTTP直接消费与独立审查均通过，唯一配置P2已修复并定向复查关闭；严格字体绑定、最终视觉与真实接入仍pending。

- 来源只读准备核对官方移动搜索数据与PC层级数据；冻结目录 `backend/app/assets/weather/regions.v1.json` 已落地。协调者只读核对3216行/3216唯一ID、规范哈希匹配a190a3529c2485e2；杭州及三处朝阳完整层级存在，重复码/蓟州蓟县冲突/缺源江干未混入。固定杭州天气页实际含当日夜间/次日白天，观测区为空，不能合成当日实况。
- OpenSpec1.13.1实际status/instructions已读取，proposal/specs/design/tasks齐全；`openspec validate city-weather --strict --no-interactive`通过，apply ready 0/7。协调者已实际读取全部contextFiles及相关事实源，不将原生制品完整状态当作代码完成。
- 客户端实际读取NLCY6、fkIRs/XzsEz、P9tls/ZHXw9/QUgPr及递归Dialog Base、Button、Label/Input和变量；390 Light/360 Dark六张来源导出已查看，三个root实际prepare仅Inter/Noto字体unresolved、pin=null。证据 `/tmp/wardrobe-weather-client-current-native.json`、`/tmp/wardrobe-weather-client-{read,cache-read,prepare}.py` 与 `current/{light,dark}/`；协调者另实际查看Light城市弹层和Dark设置。字体严格绑定沿用Plan授权pending，不代表实现视觉通过；源85d689c与core82ac8d5最终哈希未变。
- 实际微信定位、地图配置、天气生产使用条件和最终视觉/产品体验均pending。
- 提供方路由/DTO已冻结，协调者统一导出Backend OpenAPI与小程序schema通过；客户端已接续正式类型，不维护平行DTO。唯一契约、Backend说明及根Compose/环境模板补齐可选地图与天气配置，diff检查通过；未修改真实.env、未启动Compose或调用地图。
- Backend最终本地 `tests/test_weather.py`、`tests/test_profile.py` 52 passed/0 skipped；真实隔离PG/Redis `tests/test_weather_postgres.py` 9项及profile旧head保留迁移/cleanup绑定获胜2项共11 passed/0 skipped。本轮63项与前置profile检查有重叠，不作全Plan去重总数。Ruff、26文件format、architecture、Backend diff通过；目录生成器离线复算与资产逐字节一致，唯一head为8edcf8789aeb。
- PG/Redis实际覆盖3216逐条目录迁移与Alembic check、旧资料保留、城市同版本竞争/提交回滚、共享单抓取/7日EXPIREAT/负缓存/失锁/跨日/坏缓存/持锁二次检查、认证后缓存故障单次降级；HTTP阶段链验证资料/偏好/衣物/记录/统计及三类revision不误改、本人context/过期/退出/认证Redis故障，所有活跃SQLAlchemy Session在外部HTTP边界均无事务。外部天气/地图均替身，真实来源解析使用冻结原样fixture。
- 检查中发现朝阳包含9个层级候选、hangzhou子串不保证首条、一次精确用例名误写与测试块拼接位置错误，已按实际目录与原断言修正并定向通过；未删业务断言。深层HTML以128层/50000节点上限归一invalid_source，缓存事实校验有限温度、日期/时间与state一致。
- 协调者直接消费最终隔离PG/Redis真实HTTP原样data（`.tools/manager-runtime/weather-consumer-responses.json`，SHA256 5219ea01707a10077b6ae86d26bcd43cbea80e2336ef5e12918bc11486c90573）：四组城市/分页、profile保存/清除及default/saved/selected/location/missing/cache_fallback六类context。唯一parseCities/parseProfile/parseWeatherContext临时probe最终2/2 passed（21:01:19，5ms；新增cache_fallback后更新首轮2/2证据，不累加），保留真实夜间预报、null观测/气温、萧山定位missing及认证后缓存降级，未改写fixture；临时test已删除。Backend OpenAPI drift check通过。
- 客户端最终 `pnpm --dir miniprogram exec vitest run tests/weather.test.ts tests/weather-form.test.ts tests/weather-location.test.ts tests/weather-time.test.ts tests/profile.test.ts` 43/43 passed（18+5+6+2+12，与早期11/30轮重叠，不累加）；typecheck、受影响ESLint/Prettier、tokens:check、contracts:check及diff通过。覆盖唯一decoder、固定profile版本/未知结果/冲突、legacy无效城市的明确恢复、主动定位/取消与定位中手选、关闭切号迟到、搜索/分页、保存与来源/城市/日界绑定；UI去除解析版本技术标识，不展示样例温度或穿衣意见。
- 最终native节点、递归组件与变量同初读全等，helper退出且无active pins；实际prepare回执为 `/tmp/wardrobe-weather-client-prepared-{NLCY6,fkIRs,P9tls}.json`。实施上下文 `/tmp/wardrobe-weather-client-implementation-context.json` 的最终hash字段2978b2ce252cee8ccd9ecd6147ebadd6f788ed219267f852a93e4c142de5f272；严格字体binding仍pending，源与库哈希不变。
- 独立只读Reviewer对Backend/迁移/目录/事务/授权/缓存及协调者配置/文档稳定diff审查PASS。客户端唯一P2为app.config缺少实际getFuzzyLocation所需requiredPrivateInfos声明；实际核对安装Taro类型后仅补该字段，typecheck、单文件Prettier、diff及TypeScript实际求值前后配置保留检查通过。Reviewer定向复查PASS关闭P2，其他审查与43项/原样HTTPprobe结果复用，不重复执行。

## 2026-10-23 原生预览权限问题

- 用户截图：衣柜业务页面已运行，微信预览上传返回 `-80424: [getFuzzyLocation] is not authorized`。这是微信上传权限检查，不能由已经通过的腾讯地图WebService测试替代。
- 本次回读 `src/app.config.ts`、`dist/app.json`、安装的Taro类型与真实调用：两份manifest均含 `requiredPrivateInfos: [getFuzzyLocation]`；定位仅由用户点击触发，GCJ-02模糊坐标经Backend逆地址解析，拒绝/取消保留手选城市；不调用精确位置/后台定位，不保存原始坐标到weather_contexts。
- 用户授权Chrome读取并准备申请；浏览器站点安全策略阻止访问 `mp.weixin.qq.com`，明确没有可批准的提示，不以其它页面/原生UI/直接API绕过。平台接口开通、类目适用性及隐私声明尚不能在当前工具内核验，结果blocked；没有删除声明或将定位伪装为可用。
- 可供真实平台申请核对的用途说明：仅在用户点击“使用当前位置”后获取模糊地理位置，用于确定天气城市、获取该城市天气并辅助衣柜穿搭建议。模糊坐标由业务后端交给腾讯位置服务完成行政区解析，不用于轨迹、后台持续定位或精确地址；用户可拒绝并手动选择城市，其他衣柜功能保持可用。第三方服务为腾讯位置服务；后台申请/隐私声明以实际表单字段及平台要求为准，未提交或声称审核通过。
- 本次没有运行时代码变动；既有代码检查结论保留，原生上传/定位及人工验收仍pending。用户完成平台开通后应重新编译并预览，不能以本报告代替平台授权。
