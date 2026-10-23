# Tasks

## 1. 受信执行实现

- [x] 1.1 AI执行者独占 `ai-service/` 实现严格wardrobe DTO、静态注册、配置/执行描述冻结与既有echo公开契约，先向协调者冻结真实输入/输出/取消字段；检查非法/空信息/单候选/自由文本/scope/幂等及旧echo直接调用者，不写生成契约、Manager或其他端。
- [x] 1.2 AI执行者追加SQL迁移和Store/core Protocol/application的必要操作，交付单Operation证据、cancel与终态/事件原子裁定；用真实隔离PG验证旧checksum/数据保留、唯一约束、并发取消/完成及事件序号，禁止改旧SQL或清业务库。
- [x] 1.3 AI执行者实现同连接prepare/invoke/validate图、ModelPort与具体结构化输出adapter/包内资源，核对一手协议及实际锁定行为；以确定性图与模型/HTTP边界替身验证最多一次调用、非法输出不修复、配置缺失零调用、冻结配置及原始响应/usage，不执行真实模型请求。

## 2. 恢复及相邻验证

- [x] 2.1 AI执行者仅使用协调者确认的55432集群独立AI数据库/角色（名称以_test结尾），通过实际Run API、单Worker与PostgresSaver故障注入检查prepare提交先于发送、sending无响应unknown、响应后崩溃复用、取消双方先胜、真实持锁连接丢失及独立CLI恢复；断言持久状态和调用次数，保留失败/修复证据，不以skip或内存替代PG，不触碰Backend库。
- [x] 2.2 AI执行者保存稳定代码后执行受影响Ruff/format、架构检查、必要离线/echo相邻回归及实际安装资源读取；不运行build/devserver/browser，不升级无关依赖，不重跑无关全库。返回精确命令/结果/文件、原样非凭据HTTP响应及恢复局限，协调者统一勾任务。

## 3. 契约和独立收尾

- [x] 3.1 协调者从稳定提供方导出AI OpenAPI，核对严格DTO、实际HTTP原样响应及后续Backend直接消费形状，更新唯一契约/架构能力边界和必要配置注入；保持真实模型兼容性/usage为待接入，不手写生成schema，不提前实现未就绪推荐Change。
- [x] 3.2 协调者安排独立只读Reviewer审稳定代码、迁移、恢复/调用数/取消/失锁证据及新配置/契约，定向修复复验复查后回写本Change code-verified并释放下游；保留真实模型接入和M3阶段/产品验收边界，不自动归档/发布/提交。

- [x] 3.3 协调者补未知Run身份按key原子取消（tombstone无Command）、共享现有终态裁定及真实PG创建/取消并发与迟到证据测试，同步唯一契约/下游消费者并独立定向复查；此项完成前相关取消联调保持待验，不重跑未变模型/图检查。
