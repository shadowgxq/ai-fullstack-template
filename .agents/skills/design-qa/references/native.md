# 原生证据：RN iOS / Android

优先复用项目已有的 Maestro/Appium/Detox 等 runner，不在 Skill 中重写框架或安装模拟器。依据实际工具和目标包的协议执行，不能根据工具名字猜参数。

`native_evidence.py --spec native.json --out <new-dir>` 接受显式 argv 数组 captureCommand（无 shell）及 screenshot 输出路径；testCommand 可选，必须是真实 runner 命令。截图命令结束后验证 PNG、时间和 hash，记录退出状态。凭据走环境，不存 argv/输出全文。已有截图用 import 模式并记录拍摄来源；仅截图不能证明行为通过。

spec 要求 platform=ios|android、target、snapshot、build、state、viewport（逻辑宽高）、scale、source（设备/模拟器标识，勿放个人数据）。可以提供实际 contentRect/safe-area。缺逻辑尺度只能记录有限定性证据，不宣称精确像素。

测试结果、截图、源码/构建及设备必须对应；代码更新后旧图失效。Web 或 RN Web 的图片不得标为 native。分别记录 iOS/Android，不因代码共享就共用通过结论。

截图后按 comparison.md 进行真实图片审查。脚本只核对采集 provenance，不判断页面是否美观或还原；visual_checks 保持 not_run，直到有真实比较记录。无运行环境则明确 not_run，而非静默切换 Web。
