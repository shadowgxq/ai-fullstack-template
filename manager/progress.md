# 当前进度

- 日期：2026-10-23。分支 `test/wardrobe-full-flow`，HEAD `623e964a89c368c3613364b142c598050d5a492f`；业务实现及既有无关Skill/归档改动保留在工作树。未暂存、提交、推送、归档或发布。
- 当前Plan：M1–M3，9个Change/69项原生任务均完成代码验收，状态 `code-verified`；三个批次 `human_acceptance: pending`。计划与唯一任务清单分别见 [plan.yaml](plan.yaml) 及各Change的tasks.md。
- 当前授权：用户已要求启动本地Backend/AI服务并配置小程序接口，亲自验收视觉及整体流程；工程、接口及代码交互验收结果保留。此前DevTools CLI返回 `IDE service port disabled`，宿主自动化未执行；用户手动使用开发者工具不依赖CLI服务端口。真实模型测试已获当前环境持续授权，仍按任务有界执行。
- 事实源：[PRD](../docs/product/01-prd-draft.md)、[技术方案](../docs/architecture/wardrobe/overview.md)、[设计记录](../miniprogram/design/wardrobe-ui-ux.md)、[移动UI](../miniprogram/design/wardrobe-ui-spec.md)。当前设计以本轮MCP原生回读与快照为准，见下方“当前设计对齐”；本轮未编辑源稿。
- 已确认产品决定：微信登录，无需密码/手机号；照片或名称至少一项，属性可选；日期统一Asia/Shanghai；个人页内容Tab及独立设置页沿2026-10-22用户决定。舒适度自由文本仅AI补充参考，结构化风格/颜色/场合避免项为硬约束，不保证文本禁忌、不推断未知属性。PRD/推荐方案/当前Pen与页面文案已按同一决定同步。
- 字体例外：2026-10-22用户明确允许本Plan暂缓Inter/Noto Sans SC资源依赖的严格绑定，基于真实节点/组件/主题读取推进；未伪造有效pin，最终字体绑定与视觉仍pending。

## 当前设计对齐

- 2026-10-23：按用户指定的当前Pencil稿，对M1–M3的37个页面/内容源/局部/空态节点完成MCP回读、源码对照与必要调整。资料编辑改为独立页面；衣柜计数、选择控件、记录菜单/确认、设置分组、推荐/场景/依据及共享几何均纳入核对。覆盖、适配和分层证据统一见 [对齐记录](../openspec/changes/outfit-recommendations/verify-report.md#2026-10-23-m1m3-当前设计对齐)。
- 缓存入口已接通真实MCP和Cache/Flow，保留结构、依赖与2×基准；未改Pen。字体资源和独立库源同步仍无严格绑定证据，当前绑定接口未支持weapp，未伪造pin或替用其它平台。代码检查通过不表示宿主/视觉通过；本轮未重新构建，human_acceptance保持pending。

## 工程与接口验收

- M1身份/私人衣柜；M2穿着/统计/资料/偏好/天气；M3可靠AI执行及推荐到显式保存闭环均已实现。各Change的实际检查、失败修复及独立审查保留在对应verify-report.md。
- 本轮独立交互审查覆盖真实页面/Hooks/service、路由与返回、会话隔离、媒体/表单失败重试、记录修改删除/统计、个人设置/天气及推荐生成取消替换确认。发现1个P2：前台持续跨北京时间午夜仍显示旧统计。已修复日期Query/午夜第一页/恢复前台，真实页面fake-clock回归及独立定向复查PASS。
- 小程序完整 `pnpm check` PASS：32文件232项；Token/契约漂移、typecheck、Lint、Prettier通过。`build:weapp`、`check:dist` PASS；统一登录页模块导入顺序后CSS冲突警告消失。仅依赖自身punycode deprecation保留。生产构建API origin为空，只证明工程产物，不能当作已联网客户端。
- 本轮十个业务真实PG/Redis测试文件85 passed/0 skipped；推荐规则及HTTP消费者定向单测125 passed（HTTP边界为受控替身）。历史组合可能重叠，不累计全Plan总数。
- 新AI网关/SSE/reasoning/受控理由与配置的独立审查PASS，无剩余P1/P2；旧descriptor请求、终态/unknown、原样证据、至多一次发送、取消/恢复及Key/endpoint边界保持。
- 真实模型主链已通过实际loopback TCP Backend→AI API→Worker→配置网关/gpt-6.1-sol→推荐/替换→显式保存/幂等重试→历史/统计。本轮1次provider调用，usage 4137/77/4214，按配置估算USD0.009044，非账单。原paid harness整体FAIL来自后续图片格式错误断言，主链check为true；原始SSE与失败收据均保留。
- 修正测试断言后采用ModelPort替身完成69次客户端TCP HTTP、6组不变量PASS，覆盖私有图片/上传重试/仅照片录入、快照/归档/手动记录/修改删除墓碑/统计、资料城市版本冲突及越权/退出。未再次付费调用；真实provider与替身证据分开记录，详见 [Runtime报告](../openspec/changes/wardrobe-ai-runtime/verify-report.md#2026-10-23-接入独立复查与-tcp-证据)。
- 接口测试的schema/私有Redis前缀/媒体目录与TCP listeners已清理；测试结束曾停止本任务PG/Redis。按最新启动授权，现已恢复本任务55432 PG及56379 Redis，另建持久验收数据库与角色，保留所有既有数据。没有本轮创建证据的已有schema保持原样。

## 当前本地运行环境

- Backend `http://127.0.0.1:8000`、AI API `http://127.0.0.1:8003`、AI Worker、每秒调用既有有界入口的推荐dispatcher均保持运行；Windows侧两个 `/ready` 实测200。PricePilot占用8001/8002，未改动其服务。
- Backend数据库 `wardrobe_acceptance`、AI数据库 `wardrobe_acceptance_runtime`，各有独立非superuser角色；Redis使用本任务实例DB13并开启AOF。媒体保存在 `.tools/manager-runtime/local-acceptance/media`，数据不作测试后清空。
- 小程序 `.env.development.local` 已设置 `TARO_APP_API_BASE_URL=http://127.0.0.1:8000`；一次性开发构建和 `check:dist` PASS，实际包内origin已核对。仅ignored `project.private.config.json` 关闭本地合法域名校验，公共模板仍为true；该localhost地址用于Windows开发者工具，不能直接用于手机真机。
- 微信开发者工具已通过桌面导入并打开本worktree的 `ai-fullstack-miniprogram`，路径和AppID在实际窗口核对一致；未开通云开发、未启用全局CLI安全端口。用户随后提供的截图显示衣柜业务页已运行，但预览上传被微信平台以 `-80424: [getFuzzyLocation] is not authorized` 拦截。源码及dist均正确声明requiredPrivateInfos，腾讯逆地址解析Key已实测；平台接口权限/隐私声明需在微信公众平台进一步核验。用户已授权Chrome检查，但站点安全策略明确阻止访问mp.weixin.qq.com（未发起人工审批），未通过其它浏览器或API绕过，需用户手动处理后台。监听构建实际失败于 `No template for dependency: PureExpressionDependency` 并退出，已恢复此前通过的一次性开发构建和产物检查，监听未运行；失败日志保留在ignored本地运行目录，未为此改业务源码。
- 模型继续读取根ignored `.env` 的PricePilot网关/gpt-6.1-sol/SSE/medium，AI内部鉴权凭据仅服务端持有；本次启动未发起provider调用。配置和进程记录为ignored、0600，包内未发现供应商Key。
- 微信AppID `wxba737ba7cc7edb0f` 已同步小程序项目配置和Backend；用户已在本地填写 `WECHAT_APP_SECRET`，配置校验及Backend重启通过，ready 200。首次真实微信code交换待用户在开发者工具点击登录验证，不以配置存在或ready通过冒称登录成功。
- 腾讯位置服务“智能衣柜”应用及“智能衣柜-本地后端”Key已在用户账号创建。用户明确同意两份平台协议并要求临时不限域名/IP，额外勾选WebServiceAPI，未开通付费服务。Key仅写入ignored `backend/.env`，0600，未进入小程序JS包；Backend已重启。一次公开杭州合成坐标经实际TencentGeocoder调用返回provider status=0，解析为浙江省/杭州市/拱墅区，再经真实业务数据库匹配 `cn-101210112`；没有使用用户位置或写入业务数据。脱敏收据 `.tools/manager-runtime/local-acceptance/tencent-map-probe.json`；微信端主动定位/隐私权限与完整宿主操作仍待用户实测。用户计划后续替换该临时Key。

## 待验与下一步

- 接口与代码交互验收完成，本地服务、微信配置、地图Key和开发构建已就绪；用户可在开发者工具重新编译当前miniprogram项目，开始真实登录、选图、导航与业务流程。主动定位仍需在微信端实际验证隐私配置及权限。不能用TCP/API或构建替代微信宿主验收。
- 视觉由用户验收：业务Light/Dark、390及360/375/430宽度、长内容、胶囊/安全区、键盘及固定操作；字体严格绑定仍按Plan例外pending。
- 接入尚待核验：Backend匹配AppID/Secret的真实微信交换、隐私/合法域名、微信模糊定位权限、中国天气网生产使用条件、媒体目标持久卷与备份还原、部署端HTTPS及受控周期调度。腾讯Key已实测一次逆地址解析；真实AI单case不代表模型质量/容量全面验收。
- 归档、提交、推送、发布分别等待用户明确要求，人工状态继续pending。
