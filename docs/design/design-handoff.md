# 设计交付约定

本页提供模板的平台与适配参数。任务路由见 [前端导航](../engineering/frontend/README.md#任务路径)，通用读取、制稿、实现与验证动作由同一 Skills 来源的 `DESIGN-WORKFLOW.md` 和三个正式入口维护。

## 适用项目

目标包为 `frontend/`，React/Vite Web；手机画布是触控布局。框架、Provider、路由和宿主以 [技术基线](../engineering/frontend/architecture/technology-options.md) 与真实源码为准。

读取从 [根 AGENTS](../../AGENTS.md)、[文档地图](../README.md)、[frontend/AGENTS](../../frontend/AGENTS.md) 进入。无稿开发读取同一套视觉、Token、组件与状态规则，不把制稿或设计快照作为前置。

## 来源与目标

[资产登记](README.md#资产登记) 定位公共库、消费稿和预览。记录实际文档、Frame/选区、主题、状态、逻辑宽度、保存版/编辑器版和可用修订；使用节点 ID 前回读，路径和截图不能证明当前连接。

代码目标由真实页面和路由定位。业务需求由使用方 [产品入口](../product/README.md) 与 [契约](../contracts/README.md) 提供，模板例稿不构成新业务 PRD 或已批准实现。

## 组件与 Token

按 [组件治理](../engineering/frontend/components/components.md) 选择；[组件清单](../engineering/frontend/components/component-inventory.md) 只负责发现/可见性，实际 import 必须核对 export、类型与必要调用点。Pen 变体、模式和 Frame 不要求逐一生成 React 组件。

Token 按 [选择政策](tokens.md) 使用，值读 [global.css](../../frontend/src/shared/styles/global.css)。交接记录设计节点/角色 → 实际组件或组合 → API/语义 Token → 主题和适配。支持属性用真实绑定，解析值及 `metadata.token-map` 单独记录限制。

设计字体投影为 Noto Sans SC / IBM Plex Mono，Web 保留已有 sans / mono 和系统 fallback。设计字体可用不证明运行时字体已加载。

基础 Button 和菜单项使用最小高度、Token Padding 与自然换行；纯图标按钮保持方形尺寸。设计稿表达默认几何和允许的内容增长，字体放大、触控几何及必要边界仍按真实消费者核验，规范要求不等于浏览器验收已完成。尺寸在当前工具中采用 CSS 解析值并记录 `token-map`；opacity 使用 CSS 比例到画布百分数的投影，均不冒充自动 CSS 联动。

## 布局与宿主

应用标题、导航、设置与账户由 AppHeader / AppShell 承担；页面负责自己的内容。当前 AppShell 的 props 和路由用法需核对源码；不能按手机稿统一删除应用顶栏。系统时间、电池和浏览器 chrome 不重绘。

模板示例只组合已有能力：LoginModal 是当前页面上的认证浮层，`/login` 重定向并打开它；ShareDialog 消费调用方提供的 poster，窄屏可采用实际实现的底部浮层。不可把画布中的反馈当作真实请求或浏览器能力证明。

比较时固定主题、状态、平台、逻辑尺寸与已批准适配，注明整页、内容区和宿主边界；不裁剪隐藏重复顶栏、缺失区块或溢出。

## 验证接口

命令只在 [根 Makefile](../../Makefile)、[公共验证范围](../engineering/common/README.md#验证范围) 与 [前端 README](../../frontend/README.md) 维护。Lint/类型检查不能自动证明组件复用、Token 语义或设计一致性。

`.pen` 定位、读写、库导入、保存、截图与回读使用实际 Pencil MCP / `pen interactive` 能力，不使用 Computer Use 或普通文件工具编辑序列化内容。库须通过正式创建/导入机制建立连接，普通复制和改后缀不构成库复用；持久化后重开消费者检查主题及覆盖。

设计结构、Token/组件引用与实际渲染分别记录 `passed | failed | not_run` 及范围；代码、浏览器/键盘/网络行为和人工验收另行报告。没有实际查看图像时视觉为 `not_run`，没有基线时不声称设计还原通过。

## 交接与读取

复用当前 change / PR / 交接，采用共同协议的最小字段，不新建长期进度系统或复制 Token/组件正文。未实现或无法访问的能力、主题、映射和消费者如实保留。

三个正式 Skill、共同协议和必要引用必须来自同一完整来源；不只复制单个 `SKILL.md`，不认为目录存在就已安装或加载。Pencil 菜单选用的自定义 Skill 与 MCP `read_skill` 工具说明是不同上下文，均不自动取得项目读取权。不可访问时补本次必要原始规范/源码和版本，不保存长期精简副本。

## Skill 来源与安装

三个正式入口和共同协议来自 [shadowgxq/skills](https://github.com/shadowgxq/skills)。模板锁定 `snapshot-5b95f7d9dde4`，完整依赖包为 [source.zip](../../scripts/design-skills/source.zip)，来源、文件清单和 SHA-256 见 [upstream.json](../../scripts/design-skills/upstream.json)。来源基准提交为 `978f8e026db14fe4fe106293ff63a1e41ddec930`；快照包含该工作树的未发布修改，不能仅检出此提交来还原本版。

| 入口 | 声明版本 | 可复现版本 |
|---|---|---|
| `pencil-design` | `1.2.0` | 上述完整快照；采集时尚未纳入来源 Git |
| `design-to-code` | 未声明独立版本 | 上述完整快照 |
| `design-qa` | 未声明独立版本 | 上述完整快照 |
| `DESIGN-WORKFLOW.md` | 共同协议，无独立版本 | 与三个入口使用同一快照 |

依赖包原样保留 Skill、引用、脚本和必要资源；规则维护回到来源仓库，模板升级时整体更新包和摘要，不在项目另写一套执行规则。本快照不代表上游正式发布。

Codex 安装遵循 [Skills 官方说明](https://developers.openai.com/codex/skills/#where-to-save-skills)：项目入口为 `.agents/skills/`，也支持该目录中的符号链接。先用 `upstream.json` 的 `archive_sha256` 校验包；需要逐文件核对时使用其中的 `files` 清单。以下命令从仓库根目录执行，适用于 WSL / Linux / macOS，且目标目录尚不存在：

```sh
set -e
python3 - <<'PY'
import hashlib, json
from pathlib import Path
bundle = Path('scripts/design-skills')
manifest = json.loads((bundle / 'upstream.json').read_text())
assert hashlib.sha256((bundle / 'source.zip').read_bytes()).hexdigest() == manifest['archive_sha256'], 'Skill archive checksum mismatch'
PY
python3 -m zipfile -e scripts/design-skills/source.zip .tools/design-skills/snapshot-5b95f7d9dde4
mkdir -p .agents/skills
for name in pencil-design design-to-code design-qa DESIGN-WORKFLOW.md; do
  ln -s "../../.tools/design-skills/snapshot-5b95f7d9dde4/$name" ".agents/skills/$name"
done
```

Windows 原生环境可校验并解压同一包，将三个完整目录与同级 `DESIGN-WORKFLOW.md` 放入项目 `.agents/skills/`，保持相对结构。已有同名项目或用户级 Skill 时先核对来源与摘要，复用匹配版本或明确升级，不并存重复入口，也不直接覆盖已有修改。

安装后在 Codex 的技能选择器确认三个入口可发现，并分别读取对应 `SKILL.md` 及其所需协议和引用；未出现时重启 Codex 再核对。Pencil MCP / CLI 的连接与工具说明仍按实际环境验证，安装这些 Skill 不会自动安装 Pencil。

机制依据：[Design Libraries](https://docs.pen.dev/core-concepts/design-libraries)、[Variables](https://docs.pen.dev/core-concepts/variables)、[pen interactive](https://docs.pen.dev/for-developers/pen-cli)。具体能力以当前安装和实际回读为准。
