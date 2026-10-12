#!/usr/bin/env python3
"""Check frontend synchronization provenance."""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def frontend_errors(root=ROOT):
    data = json.loads((root/'scripts/frontend-source.json').read_text()); errors=[]
    for name, expected in data['files'].items():
        expected = data.get('integration_overrides', {}).get(name, {}).get('sha256', expected)
        path = root/'frontend'/name
        if not path.is_file() or sha(path) != expected: errors.append('Frontend differs from sync snapshot: '+name)
    return errors

if __name__ == '__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--frontend', action='store_true', required=True); parser.parse_args()
    errors=frontend_errors()
    print('\n'.join(errors) if errors else 'Frontend source integrity OK')
    raise SystemExit(bool(errors))
