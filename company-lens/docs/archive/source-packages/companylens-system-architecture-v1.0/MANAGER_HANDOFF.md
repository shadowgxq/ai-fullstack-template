# manager-plan-from-doc 接入说明

> 这是使用帮助和静态适配记录，不是Manager计划，不新增产品需求或第四份执行输入。

## 1. 本轮核对的 Skill

仓库：`shadowgxq/skills`  
提交：`f77052abde543d2d2365b3d18886951379193c93`  
目录：`manager-plan-from-doc`  
核对日期：2026-09-16

| 文件 | Git blob SHA |
|---|---|
| SKILL.md | 5493a8a6a3f7a5d8f9fbf66c189f1508641c4abd |
| references/manager-plan-schema.md | 909054c2620079fa82b3b01a7feec59179dda77e |
| references/planning-rules.md | 0d21aa118e0dda3637724b958ccc55a29a61c3e6 |
| templates/preview.md | 6a5b906eabfd152d8c77bcbb09819f052f527213 |
| templates/plan-write.md | 98a56bb8835ecd9f4647ebbc1ac5314c0102a5f9 |

读取范围足以核对主来源、行为提取、显式输入、scope定位、验收所有权、change合并、并行判定和写入形状。没有执行该Skill，没有生成当前项目计划或调用Manager结构校验器。

## 2. 为什么使用这个主文件

主来源是[系统技术架构](docs/architecture/ai-architecture.md)。它既有完整架构约束，也有26个SYS行为编号和78条AC验收编号；Manager仍应检查全文规范性语句并去重，不只是复制编号表。

主来源不在`docs/prd/`不影响技能读取，但按当前Skill规则不写本地PRD planning coverage marker。不要为得到marker另存一份架构副本，更不要写入没有实际发生的“需求评审：通过”。

若当前项目已有同名文件但路径不同，以原路径为主，并修改附属相对链接和调用文本。本文提供的路径是交付包的实际路径，不冒充目标仓库已落位。

## 3. 可直接使用的调用文本

在将文件按当前仓库实际路径合并后，发给编码工具：

```text
$manager-plan-from-doc

请以 docs/architecture/ai-architecture.md 为主需求来源，为 CompanyLens 生成或更新 Manager 计划预览。

当前只规划本文明确的P0与受限试用前系统保障。读取全文的规范性行为，不把章节、技术层或SQL表直接变成requirement/change；第9节SYS与AC编号用作稳定来源定位，不代表一个编号必须单独建一个change。

严格读取附录B声明的三份支持输入，按真实消费者登记inputs，同时包含各输入的共享范围与适用章节。支持文档中的R3/R4/R5及其他未来能力不自动扩成当前需求。本文只放在requirements.source，不因回链再次写成inputs。普通参考与ADR追溯链接不自动提升为执行输入。

先读取现有manager/plan.yaml、相关OpenSpec和受影响代码，保留已有计划；检查现有前端CSS Modules/Radix与旧接口的实际结构，不覆盖或重建frontend。

预览必须包括全文行为覆盖、逐条AC所有权、跨边界闭合、显式输入计数/映射、merge pass和写文件隔离审计。没有真实独立写区域证据时parallel=false。缺失输入、未闭合验收或不明确的上线条件应明确处理，不伪造实现/评审通过。

只输出完整预览；待我确认后才写manager/plan.yaml。不创建OpenSpec产物，不开发代码，不执行批次，不调用付费模型，不进行归档。
```

`$...`是宿主支持Skill调用时的表达方式，不是要求在终端运行一个同名可执行文件。主来源路径必须在实际工作仓库可读。

## 4. 输入scope示例

下面只是一个**已有change条目中的inputs字段示例**，不是完整可写计划。演示涉及Run控制和集成验证的消费者如何读取core与系统合同；实际change同时消费研究业务时，还必须单独映射第三份domain输入。

```yaml
inputs:
  - id: core-runtime-design
    kind: runtime-design
    source: docs/design/AI-Agent通用模板_技术设计与实现规范_v1.1.md
    required: true
    scope:
      - 'heading:1. 实现目标、工程边界与首期剖面'
      - 'heading:3. 技术选型与依赖方向'
      - 'heading:5. 公共数据契约'
      - 'heading:6. Runner 接口与状态转换'
      - 'heading:7. 持久化、事务和恢复'
      - 'heading:15. 应用宿主、HTTP 与前端接入合同'
  - id: system-integration-detail
    kind: system-contract
    source: docs/design/system-integration-details.md
    required: true
    scope:
      - 'heading:0. 共享合同与适用性'
      - 'heading:1. 应用数据与约束'
      - 'heading:2. 事务与恢复协议'
      - 'heading:3. HTTP 与 DTO 合同'
      - 'heading:7. 故障注入与验收接缝'
```

示例中的每个标题存在于被引用文件本身，不是父架构里的章节名。这个局部示例不声称已覆盖任一真实change的全部上下文：完整预览应按实际change收齐其他必要章节；输入不被消费才可给具体理由省略，不能因为已有父文档或标成optional就丢掉子输入。

真实plan按Skill schema生成：requirement为行为、priority为high/medium/low；OpenSpec新条目phase=change/state=planned；需要真实depends_on；不得写batch.behavior或假造review=approved。上述接口事实来自已经核对的Skill，不是本稿另造的计划格式。

## 5. 验收所有权示例

| 不合格切分 | 问题 | 合理处理 |
|---|---|---|
| “创建Run API”change声称用户已在未来结果页看到报告 | 上游change依赖尚未实现的页面才能完成验收 | 上游只承诺持久受理/可读API；用户页面行为归页面change，或把同一路径合并 |
| “数据表”“服务类”“前端hook”各一个change | 各自没有独立可使用结果 | 合并成可接受并独立执行任务的纵向服务/界面切片 |
| 两个wave按先后排列就不写depends_on | 执行序列不等于声明依赖 | 明确真实依赖，并逐条验收是否可闭合 |
| 完整访问隔离需求被多个change引用，但其中包含别的未来页面 | 重用需求的每个消费者无法满足全部AC | 拆分准确的表面行为；共用不可越权不变式按每个已引入能力验证 |
| 生成26个SYS就生成26个OpenSpec | requirement/change/task被一一对应 | 按独立意图合并，再按真实风险/验收边界拆分 |

## 6. 入仓前后检查

入仓前先比对当前架构、前端规范和ADR，不覆盖近期编辑；保留一个系统架构路径。两份v1.1快照在本包未改正文，若项目已有更新版本，先对比再更新交接source/scope，不能无脑用旧快照覆盖。

入仓后在真实仓库运行Skill预览。只有预览的全文覆盖、所有权、输入发现/结算、scope和隔离全部成立，才能按Skill流程请求确认写入。当前文档的静态检查不替代这一步。
