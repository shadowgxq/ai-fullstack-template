# CompanyLens 系统技术架构文档包

主文档：[系统技术架构](docs/architecture/ai-architecture.md)。这是唯一维护的项目级架构正文；[系统接入详细设计](docs/design/system-integration-details.md)只补技术机制，原两份v1.1负责公共内核与研究业务细节。

本包输出设计，不初始化应用、不修改远程仓库、不生成manager/plan.yaml。主文档已按用户指定的CSS Modules/Radix UI复用边界整理；没有取得当前CompanyLens代码，不能声称旧API已迁移或前端已通过回归。

## 文件布局

```text
docs/architecture/ai-architecture.md       目标、C4视图、运行、数据、接口、运维、质量、SYS/AC
docs/design/system-integration-details.md  7类数据、事务、DTO、SSE、鉴权与故障注入
docs/design/*v1.1.md                       两份输入设计的原样快照
docs/architecture/decisions/0002-0006*.md   5份短ADR
docs/references/requirement-index.json     生成导航索引，不是Manager计划或第二份规范
MANAGER_HANDOFF.md                         已核对Skill版本与可用调用文本
VALIDATION.md                             实际静态检查与未验证范围
validation-results.json                    静态检查的机器结果
```

## 合并到现有项目

先找到当前唯一ai-architecture.md，在原路径更新；若当前没有，可采用本包路径。修正相对链接，原始PRD保持原路径和历史。不得因为旧工程包含AGENTS或当前文件存在就清空frontend/ai-service。

同步当前ADR、工程规范和AGENTS中与“保留CSS Modules/Radix”冲突的Tailwind/shadcn建议；旧决策保留历史并标superseded，不靠只改摘要留下正文矛盾。本文5份ADR编号需与目标仓库现有编号协调。

建议根AGENTS只追加导航含义：“系统全局边界读ai-architecture；涉及对应模块时读附录B中适用详细设计；开发计划由Manager/OpenSpec维护；实际命令以仓库配置为准。”不要用本包重写整份已有AGENTS。

主文档列出的部署默认值、容量目标和待定项均为设计建议。未经授权不启用live；未经认证、隔离和备份验收不开放公网。模型和搜索供应商、费用、保留期与实际部署仍有明确门禁。

## 使用顺序

先读主文档第1、3、5、6、7节；实施前读第8、9节；交给Manager之前读附录B与MANAGER_HANDOFF。当前阶段规划P0；详细设计中的未来完整标准/专家团队/管理专项不自动纳入。

本包不宣称目标Skill已运行通过。静态检查结果与边界见[VALIDATION](VALIDATION.md)。
