# 穿搭推荐受信执行

## Purpose

为业务后端提供版本化、可恢复的结构化穿搭执行契约，消费已经筛选和冻结的候选与事实引用，在失败、取消、进程中断及模型结果未知时保留真实状态。该能力以单次模型调用证据防止自动重复发送，并将执行结果与最终业务授权、硬约束及用户展示分开验证。

## ADDED Requirements

### Requirement: 受信版本化输入
系统 SHALL 显式支持wardrobe.recommend.v1，接收有界、严格的候选衣物、偏好、场景、历史摘要、天气事实或缺失状态及版本引用，不以echo文本装入任意JSON。scope MUST 来自服务端认证配置，客户端不得覆盖；相同scope和幂等键的相同规范输入返回同一Run，异内容冲突。

#### Scenario: 重复与跨scope读取
- **WHEN** 同一受信调用者重复创建相同请求，或其他scope引用其Run
- **THEN** 重复请求归一为同一Run，其他scope的快照/结果/事件/取消均拒绝

#### Scenario: 空信息与不可信文本
- **WHEN** 合法候选只含一件或部分属性，且历史/偏好/天气可缺失，舒适度含自由文本
- **THEN** 输入可接受，未知保持未知，舒适度仅为数据参考，不能覆盖执行权限、结构化避免项或输出验证

### Requirement: 结构化输出与证据
执行结果 MUST 使用受控selected_ids、reason_codes、fact_refs、tradeoff_codes及调用证据引用。所选衣物至少一件、无重复且来自冻结候选；事实引用来自冻结输入，非法或不匹配输出以invalid_output失败，不自动再次调用模型修复，不公开供应商原文或内部State。

#### Scenario: 无效输出
- **WHEN** 模型返回虚构ID/事实引用、重复选择、错误结构、拒绝或截断而无有效结果
- **THEN** Run返回受控失败，保留可审查的调用证据，模型调用次数不因校验失败增加

### Requirement: 单次调用与未知结果
每个Run MUST 最多发送一次模型请求；发送前持久登记稳定操作身份、输入摘要和执行版本，完整响应及已知usage持久化后才能用作恢复依据。可能已发送但没有持久响应时 SHALL 标记call_outcome_unknown，不自动重发或伪报零费用。

#### Scenario: 发送后中断
- **WHEN** 已登记sending但进程中断，恢复时没有持久响应
- **THEN** 不再发送本次模型请求，Run失败并保留unknown证据

#### Scenario: 响应已保存而流程中断
- **WHEN** 完整响应已持久化，但流程或Checkpoint尚未更新
- **THEN** 同一Run恢复复用该响应并完成校验，不产生第二次模型请求

### Requirement: 可见取消与终态竞争
受信调用者 SHALL 能取消未完成的Run；取消意图与最终发布 MUST 原子裁定，已完成结果不倒退，确已取消不发布为成功。正在发送的请求可能已经产生费用，迟到响应可保留为内部证据但不得恢复已取消结果。

#### Scenario: 取消先胜
- **WHEN** 取消意图先于结果终态提交
- **THEN** 不发布成功结果，返回cancelled，并阻止后续尚未发送的调用

#### Scenario: 完成先胜
- **WHEN** 完成先于取消提交
- **THEN** 取消返回真实已完成状态，保留结果与事件，不改成取消成功

### Requirement: 单Worker恢复与失锁
系统 MUST 保留现有单Worker授权，持锁连接丢失后旧执行者停止Checkpoint、调用证据和结果写入，不以新连接继续旧授权。重启按同一Run及冻结输入恢复，终态与事件不可被迟到执行覆盖。

#### Scenario: 发送期间丢失持锁连接
- **WHEN** Worker丢失持锁数据库连接后模型返回
- **THEN** 旧执行者不能换连接提交结果或Checkpoint，新Worker按持久证据恢复并不重复发送未知调用

### Requirement: 明确配置与既有行为
模型配置缺失或未启用时 MUST 不发模型请求，确定性echo.v1与离线检查仍可用。既有echo HTTP协议、已保存输入和Checkpoint可恢复；迁移不得清空旧Run或改写已应用SQL文件。

#### Scenario: 无模型配置启动与旧echo恢复
- **WHEN** 未启用模型能力，或升级后继续已有echo Run
- **THEN** 不隐式连接模型，echo结果/事件/恢复保持正确，穿搭模型请求只返回真实的配置失败而非假推荐

### Requirement: 未知Run ID可按幂等键原子取消
受信调用方 SHALL 能以同scope、原workflow/input和Idempotency-Key取消既有Run，或原子记录尚未创建Run的取消状态；该操作 MUST 不为未知映射排队新执行。异输入 MUST 冲突，完成先胜 SHALL 保留结果。

#### Scenario: 取消到达早于远端创建
- **WHEN** 调用方已取消但创建结果未知，按原key/input发出取消，随后创建请求到达或重投递
- **THEN** 两者关联同一个cancelled Run且无待执行命令，不启动新模型；重复取消不添加终态事件
