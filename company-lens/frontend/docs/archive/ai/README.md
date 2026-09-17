# AI Docs

`docs/ai/` 保存 Agent 执行补充、Manager/OpenSpec 流程和模板成熟度自检，不保存前端编码细则、业务需求、接口契约或当前执行状态。

## 文件

- `agent-guide.md`：上下文收集、验证交付和模板成熟度自检。涉及复杂任务、验证口径、交接输出或模板能力扩展时读取。
- `openspec-manager-flow.md`：Manager/OpenSpec 生命周期、`manager/plan.yaml` 状态模型、batch/wave、执行入口映射、拆分粒度概览、Goal 连续推进和 Ralph shell runner。涉及 PRD 拆分、批次执行、自动循环或归档时读取。subagent handoff 格式由 `$manager-execute-current-batch` skill 自身维护，本目录不重复。

## 维护规则

- 全局文档地图和读取顺序以 `docs/README.md` 为准。
- 前端工程规范写入 `docs/frontend/`，不要复制到本目录。
- 当前执行状态写入 `manager/plan.yaml`，不要写入本目录。
- 新增 AI 文档前，优先判断能否并入现有文件；只有形成稳定独立主题时再新增文件。
