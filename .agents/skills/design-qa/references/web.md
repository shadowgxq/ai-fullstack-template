# Web 采集：React / Vue 共享

优先使用目标项目的 Playwright；脚本从目标 package.json 或 DESIGN_QA_NODE_ROOT 解析，不自动安装依赖。不保存账号凭据；storageState 由调用方管理在已忽略的安全目录，不能写入设计缓存或 Git。

运行 `node <skills>/design-qa/scripts/capture.mjs --url <page> --out <capture.png> --viewport 390x844 --dpr 1 --ready '#ready' --checks checks.json --snapshot <key> --target <target-key> --build <code-id>`。

同一页面会话完成：导航（默认 domcontentloaded）→ 已授权状态 actions → 明确 ready/assert 条件 → 停动画、字体/图像加载、连续布局稳定 → 样式和边界测量 → 截图。持续变化需要控制的项目测试数据，不能只靠固定延时宣称稳定。页面错误、缺元素、重复匹配、不可见和断言失败都记录。

actions 是数组，允许 click/fill/hover/wait/assert；assert 支持 selector 的 visible、text、count。不能 eval 任意脚本；密码/敏感填充值不要写入动作工件。等待导航不默认 networkidle。ready 缺失时采集仍可用，但 runtime_checks=not_run，不能声称主路径通过。

checks 为数组：`[{"name":"Primary","selector":"#primary","properties":["font-size"],"expect":{"font-size":"16px","border-radius":{"value":"8px","tolerance":0.5}},"box":true,"expectBox":{"width":120}}]`。缺/多元素和不可见返回失败，不取 first() 掩盖歧义。没有期望值只算采集，不算断言通过。

必须提供实际 viewport，DPR 默认 1（不是推断设计倍率）。核对基准图逻辑/像素尺寸；精细比较用显式 clip，热力图仅尺寸相同且内容区域对应时运行，不能 resize 强配。重复运行不得覆盖证据，使用每轮新输出路径。

capture 输出 PNG、同会话 `.measurements.json` 和 `.result.json`。exit 0=采集及执行过的检查无失败；exit 1=参数/环境错误；exit 2=采集完成但存在失败/不稳定。visual_checks 始终 not_run，交比较环节判断。只需测量时使用 inspect.mjs --checks <checks.json>；它不产截图，与 capture.mjs 共用同一采集引擎。
