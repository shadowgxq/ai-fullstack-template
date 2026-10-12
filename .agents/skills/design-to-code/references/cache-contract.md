# 本地快照缓存合同

脚本只实现身份、文件完整性、不可变发布及目标绑定；Agent 按实际来源 MCP 获取证据。它不会凭空验证远端新鲜度，也不生成 UI。

## 三种身份

source：provider + document + branch/namespace + 节点集合 + origin（Pencil saved-file/editor 分开）。
request：实际框架/Code Connect、节点读取范围、主题、导出尺寸/倍率、adapter 版本，写入快照签名。
target：project + package + page kind/path + platform + Unicode state + 实际 conditions/viewport/theme。没有角色/数据库/远程缓存服务。

route 模式只把整段 :id 与 [id] 归一；file 不替换括号或折叠大小写；url 保留 origin、query 值/顺序及 hash，避免丢失 tab 等状态。所有 key 的 hash 使用完整 NFC 原文，可读 slug 不参与去重依据。

## CLI

`python3 <skills>/design-to-code/scripts/cache.py keys spec.json`

`python3 <skills>/design-to-code/scripts/cache.py publish spec.json --incoming <fetched-dir> --root .design-cache`

`python3 <skills>/design-to-code/scripts/cache.py check <snapshot-dir> --task <same-task> --required structure --required baseline`

`python3 <skills>/design-to-code/scripts/cache.py bind target.json --snapshot <snapshot-dir> --project . --context src/tokens.ts --context src/components/Button.tsx`

spec 示例（不是官方 MCP 响应）：

```json
{
  "source": {"provider":"pencil","document":"design/home.pen","nodes":["home"],"origin":"editor"},
  "request": {"adapterVersion":1,"framework":"react-native","theme":"light"},
  "observation": {"method":"read","task":"current-task-id","dirty":"unknown","coversDependencies":false},
  "artifacts": [
    {"role":"structure","status":"available","path":"raw/structure.json","required":true},
    {"role":"styles","status":"available","path":"raw/styles.json","required":true},
    {"role":"baseline","status":"available","path":"baseline.png","required":true},
    {"role":"assets","status":"empty"},
    {"role":"variables","status":"unsupported","details":{"reason":"use direct styles"}}
  ],
  "target": {"project":"app","package":"mobile","page":"/home","kind":"route","platform":"android","state":"加载中"}
}
```

available 必须有实际非空文件；empty 只用于真实空资产/变量集合；unsupported、denied、error、missing 区分能力和失败，不声明文件存在。缺 required 可以发布带缺口的历史快照，但 check 不允许继续消费缺少的必要证据。无变量但有直接 styles 可以实现；基准图缺失不能视觉通过。

raw 用 JSON/TXT/XML 等非源码扩展名，生产源码 import 不得依赖缓存。脚本拒绝遍历、符号链接、重复路径、部分凭据字段以及可执行源码扩展名；这不是完整 DLP，Agent 仍须排除凭据。临时签名 URL 仅留本地敏感缓存，不进决策文档/Git。

publish 在同一文件系统临时目录写完整后原子发布，清单和每文件 hash 可复核。同 source 发布、同 target binding 用排他锁；崩溃残留锁必须由操作者确认进程结束后清理，不自动按时间抢锁。锁只保护缓存写入，生产代码的单写者由调用方负责。

## 新鲜度

仅接受 `method=revision` 或 `method=read` 的当前读取证据；发布与读取均校验方法和修订前后一致性。未知方法即使提供同一 task 或 offline 也不能复用。

新任务有可靠 revision：读取前后核对相同，记录 method=revision、before/after 及依赖覆盖，再传当前实际 revision 核对复用。没有 revision：定向重新读，method=read；同 task 固定同快照，不能在新任务复用旧 task ID。before/after 不同拒绝混合发布；无 revision 不能声称事务一致快照。

auto 无新鲜证据就 reread-required；refresh 强制重读；offline 可使用完整旧快照但 freshness=unknown。本地 hash 不是远端最新证明。sourceKey/节点未变不等于设计未改。

项目 Token、组件 API、代码/构建或状态条件改变时，重新计算 contextHash、对比 binding；旧 QA 不再有效，原设计可以继续复用。正式验证报告必须附 binding/contextHash 和 snapshotKey，调用方不得忽略差异。

URL 的有效期按 provider 真实契约，不统一七天。已下载文件的 hash/来源仍有效即可复用；只缺摘要从快照再生，只缺资产补该资产，均不重拉整页。不要生成所有平台/状态组合。

目录：`.design-cache/snapshots/<source>/<snapshot>/`、`targets/<target>/binding.json`、`verification/<target>/<unique-run>/`。缓存根自行写 .gitignore；决策复用已有 docs/Manager 文件。
