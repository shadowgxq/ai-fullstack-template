# Manager 输入边界与共享引用

## 1. 先分类，再登记

Input 是某个交付结果必须消费的具体资料，不是“执行前可能读到的所有文件”。
即使上游把一段命名为“必需输入”或“下游 handoff”，也必须逐项按用途分类，不能整段照搬。

| 来源用途 | 存放/读取位置 | 是否进入 inputs |
| --- | --- | --- |
| 产品行为与验收来源 | requirements[].source；远程来源附 snapshot | 否，不重复登记主 PRD |
| 已批准总/专项技术方案 | openspec[].technical_design | 否，不重复登记方案 |
| 已批准 UI 基线 | openspec[].ui_baseline | 否，不重复登记该基线 |
| 项目架构、编码、组件、目录、测试规范 | AGENTS.md → 对应规范索引；角色按任务补读 | 否 |
| 当前源码入口、router/provider、公共库、环境示例 | 定向调查与任务 reads；不复制成计划输入清单 | 默认否 |
| 本次交付的 API 契约、Schema、数据集、设计资产、服务联调快照 | inputs / input_refs | 是，记录消费者与用途 |

分类按语义，不只看文件名或目录。工程目录中的权限矩阵可能是正式验收基线；代码或 token 文件只有作为明确版本的交付基线时才是 Input。不得只改 kind 名称来绕过分类。
移出 inputs 不等于忽略规范：必须确认已有 AGENTS/角色路由能找到它。缺路由时先报告并在获得授权后补入口；不能删除规则，也不能为求稳把所有规范重新塞进每个 Change。
不复制资料正文，不把模板 .env.example 当成真实服务地址/联调环境。上游尚未产出的契约保留明确生产者依赖，在消费者执行前核验可用性。

## 2. 顶层定义，按需消费

公共资料使用顶层 `inputs` 列表定义一次；具体 Change 通过 `input_refs` 引用。
只被一个 Change 使用的真实资料可以继续放在该 Change 的 `inputs`，兼容既有格式。
两个及以上 Change 消费相同 id 和完整定义时，必须提升到顶层；公共不等于所有 Change 自动继承。

```yaml
inputs:
  - id: team-site-api
    kind: api-contract
    source: docs/api/contracts.md
    required: true
openspec:
  - id: team-site-todos
    technical_design: [docs/technical/team-site/overview.md]
    input_refs: [team-site-api]
  - id: team-site-announcements
    technical_design: [docs/technical/team-site/overview.md]
    input_refs: [team-site-api]
  - id: unrelated-work
    # 未引用 team-site-api，因此不会读入它。
    inputs: []
```

引用规则：
- `input_refs` 只允许顶层 Input ID；不能引用另一个 Change 的局部定义。
- 不允许局部同名覆盖顶层，不允许嵌套引用或引用循环。缺定义、重复 ID/引用必须报错，不回退为空。
- 每个定义仍保留 id/kind/source/required，以及适用的 scope/snapshot。未指定 scope 或空 scope 表示整份来源，不是省略资料。
- 来源相同但 scope、required、snapshot 或其他元数据不同，不自动求并集、放宽或升级必需性。新计划为不同消费视图使用清晰的不同 ID；旧计划的局部差异先原样保留。
- 不按每个章节/每个字段制造一个 Input。同一消费视图的多个真实 locator 放同一个 scope；共享约束也必须包含在该视图中。
- 输入列表没有处理顺序或覆盖优先级；真实时序仍由 depends_on 和任务依赖表示。
- 已被 requirements/source、technical_design 或 ui_baseline 提供的同一来源，不再复制为 supporting Input。不同用途可在交接中说明，但只解析一次来源。

## 3. 规划与写入

候选台账逐项标明：规范上下文、源码调查、已有专用字段、真正输入、重复/不消费，并保留声明位置和去向。
候选处理完整不等于全部写入 inputs。真正子资源如契约/数据/图片独立登记；规范链接和普通参考资料不因出现在父文档中就晋升为 Input。
先形成合理 Change 边界，再归并公共定义；不要为缩短每个 Change 而建立全项目上下文大包。
新增计划可直接输出规范形态；已有重复计划可先运行 `normalize-inputs` 生成无损预览，再做人工可审查的语义分类。
新计划交付前运行 `validate --strict-inputs`，不仅看 YAML 能否解析。

## 4. 执行、修订与归档

有效 supporting inputs = 当前 Change 的 input_refs 展开 + 当前 Change 的局部 inputs。
`resolve-inputs --change <id>` 和 `next` 的 entry.inputs 使用同一解析逻辑；解析输出是独立副本，只交接给实际消费者。required/scope/snapshot 原样保留；来源可读性及 locator 仍由真实工具核验。
PRD、技术方案、UI 基线继续从其专用字段提供，项目规范继续通过 AGENTS 路由读取。共享 registry 不是公共 system prompt，不能整份广播给所有 Agent。
Review、Verify、内容摘要和修订影响分析也必须用同一有效输入集合。修改公共定义时检查所有引用者，不能只使当前 Change 重新验收。
归档前将当前 Change 消费的完整定义随本次完成记录封存，避免历史引用可变 registry；不修改已有归档。剪枝时保留仍被活动 input_refs 引用的定义。

## 5. 兼容与工具边界

普通 validate 保持旧 inline 格式可读，重复/明显规范类输入给警告；新计划使用 --strict-inputs 将这些问题视为错误。
结构错误始终阻止解析与 CLI 状态操作。规范分类检查覆盖明确的 kind 和已有专用来源；无法机械识别的语义仍需按第 1 节审查，不能宣称脚本自动理解所有文档。

```bash
python3 <execute-skill>/scripts/plan_tool.py --plan manager/plan.yaml validate --strict-inputs
python3 <execute-skill>/scripts/plan_tool.py --plan manager/plan.yaml resolve-inputs --change team-site-todos
python3 <execute-skill>/scripts/plan_tool.py --plan manager/plan.yaml normalize-inputs
python3 <execute-skill>/scripts/plan_tool.py --plan manager/plan.yaml normalize-inputs --output manager/plan.normalized.yaml
```

normalize-inputs 只提升相同 ID、完整定义一致的重复项，不删除规范、改名 ID、合并不同 scope 或重写状态。涉及 done/cancelled 记录的同 ID 分组保持原样，先通过受控归档剪枝处理历史，不迁移历史快照。默认只预览；--output 只创建新文件，拒绝覆盖已有文件或活动计划。
预览里仍有分类警告时，结构去重不等于完成修复。采用迁移结果前核对消费者、输入语义和相应批准/证据；已有内容绑定机制可能需要重建凭证，不自动宣称旧凭证继续有效。
此输入补丁不改变项目现有审批、阶段推进或验证命令的实现。
