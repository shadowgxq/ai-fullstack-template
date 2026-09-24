# 前端初始化与上游同步

从标准 frontend 整体复制代码和工程文件，再应用本项目 API/proxy、Docker 与文档导航差异；不手写“看起来相似”的组件版本。固定来源提交、保留来源 lockfile，校验文件哈希；记录集成例外和原因。

同步清单见 [frontend-source.json](../../../../scripts/frontend-source.json)。`python3 scripts/check_sources.py --frontend` 比较当前文件与同步收尾快照，列出未经记录的差异；清单是来源证据，不要求将后续业务代码回滚成模板。更新基线时重新审查例外，不能先删断言再宣称一致。

排除来源自身 docs、前端级 .codex/.claude、独立部署 Caddy/Railway、无关业务 HTML；不复制参考仓库其他目录。当前项目文档在 `docs/engineering/frontend` 按最终代码维护，frontend AGENTS 只导航。

安装、检查、开发与整栈启动见 [frontend README](../../../../frontend/README.md)。生产 API 不可用时不回退 mock；新能力先确认真实 backend 契约。公共 token、Theme、Provider、Router、组件只保留一份，不并行创建来源版和全栈版。
