#!/usr/bin/env python3
"""Read saved .pen evidence only. Not a renderer, instance evaluator, or MCP substitute."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import re

# Preserve strings while stripping JSON comments; never execute script nodes.
COMMENT = re.compile(r'("(?:\\.|[^"\\])*")|//[^\r\n]*|/\*[\s\S]*?\*/')


def read_saved(file, node_id):
    file = Path(file)
    if file.suffix.lower() != '.pen' or not file.is_file() or file.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('expected an existing .pen file smaller than 64 MiB')
    data = file.read_bytes()
    raw = data.decode('utf-8-sig')
    clean = COMMENT.sub(lambda m: m.group(1) if m.group(1) is not None else ' ', raw)
    doc = json.loads(clean)
    if not isinstance(doc, dict) or not isinstance(doc.get('version'), str) or not doc['version']:
        raise ValueError('missing document schema version; do not guess or convert it')
    if not isinstance(doc.get('children'), list):
        raise ValueError('document children must be an array')
    index, script_ids = {}, []
    stack = list(doc['children'])
    while stack:
        node = stack.pop()
        if not isinstance(node, dict) or not isinstance(node.get('id'), str) or not node['id'] or '/' in node['id'] or not isinstance(node.get('type'), str):
            raise ValueError('malformed serialized node identity/type')
        if node['id'] in index:
            raise ValueError('duplicate serialized node id')
        index[node['id']] = node
        if node['type'] == 'script':
            script_ids.append(node['id'])
        children = node.get('children', [])
        if not isinstance(children, list):
            raise ValueError('node children must be an array')
        stack.extend(children)
    if node_id not in index:
        raise ValueError('target node not found in saved document')
    selected, references = [], set()
    stack = [index[node_id]]
    while stack:
        node = stack.pop(); selected.append(node['id'])
        if node.get('type') == 'ref':
            references.add(str(node.get('ref', '')))
        stack.extend(node.get('children', []))
    return {'provider': 'pencil', 'origin': 'saved-file', 'document': str(file.resolve()),
            'schemaVersion': doc['version'], 'fileHash': hashlib.sha256(data).hexdigest(),
            'node': index[node_id], 'selectedIds': sorted(selected),
            'referencedComponents': sorted(references),
            'unresolvedReferences': sorted(references - set(index)),
            'variables': doc.get('variables', {}), 'themes': doc.get('themes', {}),
            'gaps': ['saved-file-only: editor state not checked', 'no rendered baseline',
                     'instances, overrides, variable values and external assets require provider evaluation'],
            'scriptNodesNotExecuted': script_ids, 'live_mcp': 'not_run', 'visual_checks': 'not_run'}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('file'); p.add_argument('--node', required=True)
    args = p.parse_args()
    try:
        print(json.dumps(read_saved(args.file, args.node), ensure_ascii=False, indent=2)); return 0
    except (ValueError, OSError, TypeError, RecursionError) as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}, ensure_ascii=False)); return 1


if __name__ == '__main__':
    raise SystemExit(main())
