## 1. Backend（原后端执行者，仅backend/，依赖M1已验证）

- [x] 1.1 扩展分组创建/改名/删除 schema、service/repository/router 与kind/回执，名称唯一/存储约束、固定名称/权限与删除expected_count/原子迁移规则正确。
- [x] 1.2 增加分组API与真实PG竞争/回滚/排序/计数/回执及跨M1–M2真实HTTP生命周期测试，完成必要后端检查；仅专属隔离PG。

## 2. UI（原前端执行者，仅frontend/，design-to-code tasks2.1–2.2）

- [x] 2.1 实际读取design所选依据并prepare；扩展合法kind/回执/恢复，接通分组入口、共用名称表单/删除确认、收藏分组选择与联合查找、成功跳转及失败/unknown/影响变化恢复。
- [x] 2.2 增加正常/权限与边界/计数冲突/unknown恢复等相邻行为测试，typecheck/受影响lint/格式及M1回归；CAS绑定新实现context并释放pins，不改Pen。

## 3. Coordination（协调者，仅docs/当前Change/manager）

- [x] 3.1 生成/校验新增分组OpenAPI，同步消费者与来源登记，完成保存到组→搜索→改名→删组→未分组的阶段集成和必要静态检查。
- [x] 3.2 交独立Reviewer审稳定新增diff、修复复查，记录真实验证后回写M2 code-verified；产品pending，不提交/归档。
