#!/usr/bin/env python3
"""Check installed Skill snapshots and optional frontend synchronization provenance."""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def manager_errors(root=ROOT):
    manifest = root / 'scripts/manager/upstream.json'
    if not manifest.exists(): return []
    data = json.loads(manifest.read_text()); errors = []
    for row in data['files']:
        path = root/row['path']
        if not path.is_file() or path.is_symlink() or sha(path) != row['sha256']:
            errors.append('Manager installed file drift: '+row['path'])
    return errors

def managed_paths(root):
    manifest = root/'scripts/manager/upstream.json'
    if not manifest.exists(): return set()
    return {r['path'] for r in json.loads(manifest.read_text())['files']}

def frontend_errors(root=ROOT):
    data = json.loads((root/'scripts/frontend-source.json').read_text()); errors=[]
    for name, expected in data['files'].items():
        expected = data.get('integration_overrides', {}).get(name, {}).get('sha256', expected)
        path = root/'frontend'/name
        if not path.is_file() or sha(path) != expected: errors.append('Frontend differs from sync snapshot: '+name)
    return errors

if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--frontend', action='store_true'); args=parser.parse_args()
    errors=manager_errors()+(frontend_errors() if args.frontend else [])
    print('\n'.join(errors) if errors else 'Installed source integrity OK')
    raise SystemExit(bool(errors))
