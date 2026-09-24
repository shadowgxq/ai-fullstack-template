"""Refresh the pinned Manager package; preserve this project's integration policy."""
from pathlib import Path
import hashlib
import json
import shutil
import sys

root = Path.cwd()
source = Path(sys.argv[1])
package = root / '.agents/skills'
manifest_path = root / 'scripts/manager/upstream.json'
manifest = json.loads(manifest_path.read_text())
assert manifest['commit'] == 'db8f983c7e4626e9e4025493dfaa95d1f220ad55'
old = {row['source'] for row in manifest['files']}
files = {str(p.relative_to(source)): p for p in source.rglob('*') if p.is_file()}
assert old <= set(files)
assert len(files) == 57
for name, p in files.items():
    assert not p.is_symlink() and '..' not in Path(name).parts
    target = package / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(p, target)
manifest['version'] = '2.0.0'
manifest['commit'] = '6625edca2397a4f67d6ca82dace0bd0a41c08243'
manifest['files'] = [{'source': name, 'path': str((package/name).relative_to(root)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for name,p in sorted(files.items())]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')

config = (source / 'templates/project/.codex/config.toml').read_text()
for before, after in [('docs/prd','docs/product'),('docs/technical','docs/architecture'),('docs/design','docs/design/baselines')]:
    config = config.replace(before, after)
config = config.replace('"docs/architecture" = "read"', '"docs/architecture" = "read"\n"docs/contracts" = "read"')
for heading in ['[permissions.manager-normal.filesystem.":workspace_roots"]','[permissions.manager-review.filesystem.":workspace_roots"]']:
    denies = '\n'.join(f'"{service}/{env}" = "deny"' for service in ('frontend','backend','ai-service') for env in ('.env','.env.local','.env.production'))
    config = config.replace(heading, heading+'\n'+denies)
(root/'.codex/config.toml').write_text(config)
for role in (source/'templates/project/.codex/agents').glob('*.toml'):
    (root/'.codex/agents'/role.name).write_bytes(role.read_bytes())
roles = (source/'templates/project/manager/roles.yaml').read_text()
roles = roles.replace('    tests:\n', '    ai-service:\n      agent_type: backend-dev\n    tests:\n')
(root/'manager/roles.yaml').write_text(roles)

p = root/'docs/engineering/workflow/tooling.md'
s = p.read_text().replace('db8f983c7e4626e9e4025493dfaa95d1f220ad55','6625edca2397a4f67d6ca82dace0bd0a41c08243').replace('8 个 runtime 模块','9 个 runtime 模块').replace('控制器 rc.3','控制器 2.0.0')
s = s.replace('项目级配置，默认保护计划/历史', '项目级配置，角色文件自动发现，默认保护计划/历史')
s = s.replace('运行状态/批准/claims/ticket/预算持久化及保密要求', '新增安装使用 `.agents/skills/scripts/init_manager_project.py <project>` 预览；明确授权后 `--write` 仅补缺失文件，已有项目配置需合并，不能整体覆盖。本项目的 `change/apply/verify` 路由分别对应方案、实现与最终独立 reviewer；QA 负责取证，不代替最终 reviewer。`resolve-role --role <name>` 只报告配置，不证明真实模型已运行。完整约束见 [角色协议](../../../.agents/skills/manager-execute-current-batch/references/role-contract.md)。\n\n运行状态/批准/claims/ticket/预算持久化及保密要求')
p.write_text(s)
p = root/'docs/engineering/workflow/delivery.md'
s = p.read_text().replace('Worker 返回修改、结果与证据；Manager 核对后单写 plan/tasks。', '原生写入 Worker 即使串行也必须使用 execution.yaml，先 claim 再写；无图只用于明确许可的 Manager 直接串行实现。Worker 返回修改、结果与证据；Manager 核对后单写 plan/tasks。最终独立 reviewer 不由 QA 或实现线程替代。')
p.write_text(s)
p = root/'manager/README.md'
s = p.read_text().replace('`roles.yaml` 路由到根 `.codex/agents`', '`roles.yaml` 的 change/apply/verify 路由到根 `.codex/agents`，verify 使用独立 reviewer')
s += '\n角色配置预检用 `python3 scripts/manager/plan_tool.py resolve-role --role reviewer`；原生写入 Worker 使用已声明 execution.yaml 并先 claim。初始化器只补缺失配置，不修改已有业务计划或批准，说明见 [工具入口](../docs/engineering/workflow/tooling.md)。\n'
p.write_text(s)
print('Refreshed',len(files),'pinned Manager files; project paths and policy preserved.')
