#!/usr/bin/env python3
"""Preview/copy missing Manager templates. Existing project files are never overwritten."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'manager-execute-current-batch/scripts'))
from manager_store import Store, decode, safe
from manager_schema import Invalid, require


def initialize(project, write=False):
    root = Path(project).absolute()
    require(root.is_dir() and not root.is_symlink(), 'project must be an existing non-symlink directory')
    template = ROOT / 'templates/project'
    names = ['.codex/config.toml', 'manager/roles.yaml', 'manager/policy.yaml']
    names += [str(p.relative_to(template)) for p in sorted((template / '.codex/agents').glob('*.toml'))]
    require(len(names) > 3, 'native role templates missing')
    # Preflight every path before any creation. Never read or copy credentials.
    entries = []
    for name in names:
        source = safe(template, name); destination = safe(root, name)
        require(source.is_file(), f'missing template: {name}')
        require(not destination.exists() or destination.is_file(), f'not a regular file: {name}')
        content = source.read_bytes()
        status = 'missing' if not destination.exists() else 'identical' if destination.read_bytes() == content else 'preserved'
        entries.append((name, destination, content, status))
    if write:
        journal = safe(root, 'manager/runtime/transaction.json')
        require(not journal.exists(), 'recover existing Manager transaction before initialization')
        state_path = safe(root, 'manager/runtime/state.json')
        if state_path.exists():
            state = decode(state_path.read_text())
            require(isinstance(state, dict), 'invalid runtime state; do not overwrite it')
            for collection, active in (('claims', 'running'), ('repairs', 'running'), ('sessions', 'active'), ('tickets', 'prepared')):
                require(isinstance(state.get(collection, {}), dict), f'invalid runtime collection: {collection}')
                require(not any(r.get('status') == active for r in state.get(collection, {}).values()), 'stop active Manager work before changing project configuration')
        for name, destination, content, status in entries:
            if status != 'missing': continue
            # Exclusive creation prevents overwriting a concurrent user-created file.
            safe(root, name)
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open('xb') as handle:
                handle.write(content)
    return {'written': write, 'created' if write else 'would_create': [n for n, _, _, s in entries if s == 'missing'],
            'preserved': [n for n, _, _, s in entries if s == 'preserved'],
            'identical': [n for n, _, _, s in entries if s == 'identical'],
            'next': 'Review preserved config/roles; replace policy checks with real project commands, then run doctor. No model calls, approvals, plan or runtime were created.'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('project', help='Existing business project directory, not the global skills directory')
    parser.add_argument('--write', action='store_true', help='Create missing files only; default is a read-only preview')
    args = parser.parse_args(argv)
    try:
        print(json.dumps(initialize(args.project, args.write), ensure_ascii=False, indent=2))
        return 0
    except (Invalid, OSError, ValueError, TypeError) as exc:
        print(json.dumps({'ok':False,'error':str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
