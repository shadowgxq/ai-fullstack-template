#!/usr/bin/env python3
"""Project-local evidence cache. No MCP calls, source edits, or code generation."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
import unicodedata
from urllib.parse import parse_qsl, urlsplit

VERSION = 1
STATUSES = {'available', 'empty', 'unsupported', 'denied', 'error', 'missing'}
EMPTY_ROLES = {'assets', 'variables'}
SECRET_KEYS = {'authorization', 'password', 'access_token', 'refresh_token', 'api_key', 'cookie', 'storagestate'}


def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical_json(value).encode('utf-8')).hexdigest()


def text(value, name):
    if not isinstance(value, str) or not value.strip() or '\x00' in value:
        raise ValueError(f'{name} must be a nonempty string')
    return unicodedata.normalize('NFC', value.strip())


def key(label, value):
    slug = re.sub(r'[^a-z0-9_$-]+', '-', str(label).lower()).strip('-')[:48] or 'item'
    return f'{slug}--{digest(value)[:24]}'


def no_secrets(value):
    if isinstance(value, dict):
        for k, v in value.items():
            if str(k).lower() in SECRET_KEYS:
                raise ValueError('credential field is not permitted in evidence metadata')
            no_secrets(v)
    elif isinstance(value, list):
        for v in value:
            no_secrets(v)


def canonical_page(value, kind='route'):
    value = text(value, 'page')
    if kind == 'url':
        parsed = urlsplit(value)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError('expected an http(s) page URL without credentials')
        pairs = parse_qsl(parsed.query, keep_blank_values=True)
        no_secrets(dict(pairs))
        # Preserve query values and their order: duplicate keys can be stateful.
        return {'kind': kind, 'path': f'{parsed.scheme.lower()}://{parsed.netloc.lower()}{parsed.path or "/"}',
                'query': pairs, 'fragment': parsed.fragment}
    if kind == 'file':
        # File paths are not route patterns. Do not fold case, query or brackets.
        return {'kind': kind, 'path': str(PurePosixPath(value.replace('\\', '/')))}
    if kind != 'route' or '://' in value:
        raise ValueError('page kind must be route, url, or file')
    parts = value.split('/')
    normalized = []
    for part in parts:
        if not part:
            continue
        match = re.fullmatch(r'\[([A-Za-z_][\w-]*)\]|:([A-Za-z_][\w-]*)', part)
        normalized.append('$' + (match.group(1) or match.group(2)) if match else part)
    return {'kind': kind, 'path': '/' + '/'.join(normalized)}


def parse_figma_url(value):
    parsed = urlsplit(text(value, 'figma URL'))
    if parsed.scheme != 'https' or parsed.hostname not in ('figma.com', 'www.figma.com') or parsed.username or parsed.password:
        raise ValueError('expected an https Figma design/file URL')
    parts = [v for v in parsed.path.split('/') if v]
    if len(parts) < 2 or parts[0] not in ('design', 'file') or not re.fullmatch(r'[A-Za-z0-9_-]+', parts[1]):
        raise ValueError('missing Figma document identity')
    nodes = [v for k, v in parse_qsl(parsed.query) if k == 'node-id']
    if len(nodes) != 1 or not re.fullmatch(r'\d+[:-]\d+', nodes[0]):
        raise ValueError('exactly one numeric node-id is required')
    branch = None
    if 'branch' in parts:
        i = parts.index('branch')
        if i + 1 >= len(parts) or not re.fullmatch(r'[A-Za-z0-9_-]+', parts[i + 1]):
            raise ValueError('invalid branch identity')
        branch = parts[i + 1]
    node = nodes[0].replace('-', ':')
    return {'provider': 'figma', 'document': parts[1], 'branch': branch, 'nodes': [node], 'origin': 'remote'}


def source_identity(source):
    if not isinstance(source, dict) or source.get('provider') not in ('figma', 'pencil'):
        raise ValueError('source provider must be figma or pencil')
    nodes = source.get('nodes')
    if not isinstance(nodes, list) or not nodes:
        raise ValueError('source.nodes must identify at least one node')
    provider = source['provider']
    origin = source.get('origin', 'remote' if provider == 'figma' else None)
    if origin not in (('remote',) if provider == 'figma' else ('saved-file', 'editor')):
        raise ValueError('Pencil must distinguish saved-file from editor')
    return {'provider': provider, 'document': text(source.get('document'), 'document'),
            'nodes': sorted(set(text(v, 'node') for v in nodes)), 'branch': source.get('branch'),
            'namespace': source.get('namespace'), 'origin': origin}


def target_identity(target):
    if not isinstance(target, dict) or target.get('platform') not in ('web', 'ios', 'android'):
        raise ValueError('target requires web, ios, or android platform')
    result = {'project': text(target.get('project'), 'project'), 'package': text(target.get('package', '.'), 'package'),
              'page': canonical_page(target.get('page'), target.get('kind', 'route')),
              'state': text(target.get('state', 'default'), 'state'), 'platform': target['platform'],
              'conditions': target.get('conditions', {}), 'viewport': target.get('viewport'), 'theme': target.get('theme')}
    no_secrets(result)
    canonical_json(result)
    return result


def safe_path(root, name):
    if not isinstance(name, str) or not name or '\\' in name or ':' in name or '\x00' in name:
        raise ValueError('unsafe relative artifact path')
    rel = PurePosixPath(name)
    if rel.is_absolute() or any(p in ('..', '.') for p in name.split('/')) or name.endswith('/'):
        raise ValueError('artifact path must stay within its root')
    root = Path(root).resolve()
    candidate = root.joinpath(*rel.parts)
    for item in (candidate, *candidate.parents):
        if item == root:
            break
        if item.is_symlink():
            raise ValueError('symlinks are not valid evidence paths')
    if not candidate.resolve().is_relative_to(root):
        raise ValueError('artifact escapes root')
    return candidate


def artifact_identity(name):
    """Portable, conservative path identity for case-insensitive Windows/macOS targets.

    Reject spellings that Windows may silently alias (including reserved names,
    trailing dots/spaces and ambiguous separators) before writing any artifact.
    """
    if not isinstance(name, str) or not name or '\\' in name or ':' in name or '\x00' in name:
        raise ValueError('unsafe artifact path')
    parts = name.split('/')
    if any(not part or part in ('.', '..') or part.endswith(('.', ' ')) for part in parts):
        raise ValueError('nonportable artifact path')
    reserved = {'con', 'prn', 'aux', 'nul', *(f'com{i}' for i in range(1, 10)),
                *(f'lpt{i}' for i in range(1, 10))}
    folded = []
    for part in parts:
        canonical = unicodedata.normalize('NFC', part).casefold()
        if canonical.split('.')[0] in reserved:
            raise ValueError('Windows device-name artifact path')
        folded.append(canonical)
    return '/'.join(folded)


@contextmanager
def lock(root, name):
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    p = safe_path(root, key('lock', name) + '.lock')
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        os.write(fd, str(os.getpid()).encode())
        os.close(fd)
        fd = None
        yield
    finally:
        if fd is not None:
            os.close(fd)
        p.unlink(missing_ok=True)


def init_root(root):
    root = Path(root).resolve()
    root.mkdir(parents=True, exist_ok=True)
    p = safe_path(root, '.gitignore')
    if not p.exists():
        p.write_text('# Sensitive, regenerable design evidence. Never commit raw cache.\n*\n!.gitignore\n', encoding='utf-8')
    return root


def identity_payload(manifest):
    return {k: manifest[k] for k in ('version', 'source', 'request', 'observation', 'artifacts')}


def artifact_ready(entry):
    return entry['status'] == 'available' or (entry['status'] == 'empty' and entry['role'] in EMPTY_ROLES)


def validate_observation(observation):
    """Validate current retrieval evidence before publication or reuse."""
    if not isinstance(observation, dict) or observation.get('method') not in ('revision', 'read'):
        raise ValueError('observation.method must be revision or read')
    before, after = observation.get('before'), observation.get('after')
    if before is not None and after is not None and before != after:
        raise ValueError('source changed during retrieval; do not publish mixed evidence')
    if observation['method'] == 'revision' and (not before or not after):
        raise ValueError('revision observation requires matching before and after')


def publish(root, spec, incoming):
    """Copy fetched artifacts into an immutable snapshot. Gaps stay explicit."""
    if not isinstance(spec, dict):
        raise ValueError('snapshot spec must be an object')
    root = init_root(root)
    source = source_identity(spec.get('source'))
    request = spec.get('request', {})
    observation = spec.get('observation', {})
    if not isinstance(request, dict) or not isinstance(observation, dict):
        raise ValueError('request and observation must be objects')
    observation = dict(observation)
    no_secrets({'source': source, 'request': request, 'observation': observation})
    validate_observation(observation)
    declared = spec.get('artifacts')
    if not isinstance(declared, list) or not declared:
        raise ValueError('declare available artifacts and missing capabilities')
    source_key = key(source['provider'], source)
    parent = safe_path(root, 'snapshots/' + source_key)
    parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='.pending-', dir=parent))
    try:
        entries, seen = [], set()
        for item in declared:
            if not isinstance(item, dict) or item.get('status') not in STATUSES:
                raise ValueError('invalid artifact status')
            role = text(item.get('role'), 'artifact role')
            name = item.get('path')
            status = item['status']
            required = item.get('required', False)
            if not isinstance(required, bool):
                raise ValueError('artifact.required must be a boolean')
            if status == 'empty' and role not in EMPTY_ROLES:
                raise ValueError('structure/styles/baseline cannot be a successful empty artifact')
            entry = {'role': role, 'status': status, 'required': required}
            if 'details' in item:
                no_secrets(item['details'])
                entry['details'] = item['details']
            if status == 'available':
                identity = artifact_identity(name)
                dst = safe_path(stage, name)
                if identity == 'manifest.json' or identity in seen or dst.suffix.lower() in ('.tsx', '.jsx', '.vue', '.js', '.mjs', '.py'):
                    raise ValueError('duplicate/reserved path or executable cache extension; use .txt')
                seen.add(identity)
                src = safe_path(incoming, name)
                if not src.is_file() or src.stat().st_size > 64 * 1024 * 1024:
                    raise ValueError('artifact missing or larger than 64 MiB')
                data = src.read_bytes()
                if not data:
                    raise ValueError('available artifact must not be empty')
                dst.parent.mkdir(parents=True, exist_ok=True)
                dst.write_bytes(data)
                entry.update(path=name, sha256=hashlib.sha256(data).hexdigest(), size=len(data))
            elif name is not None:
                raise ValueError('unavailable/empty artifacts must not claim a file path')
            entries.append(entry)
        manifest = {'version': VERSION, 'source': source, 'request': request,
                    'observation': observation, 'artifacts': sorted(entries, key=canonical_json)}
        snapshot_key = key('snapshot', identity_payload(manifest))
        manifest.update(sourceKey=source_key, snapshotKey=snapshot_key,
                        createdAt=datetime.now(timezone.utc).isoformat())
        (stage / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
        # Validate the fully staged snapshot before exposing it under an immutable key.
        errors = validate(stage, check_directory=False)
        if errors:
            raise ValueError('invalid staged snapshot: ' + '; '.join(errors))
        destination = parent / snapshot_key
        with lock(root / 'locks', source_key):
            if destination.exists():
                errors = validate(destination)
                if errors:
                    raise ValueError('existing immutable snapshot is corrupt: ' + '; '.join(errors))
            else:
                os.replace(stage, destination)
        return {'path': str(destination), 'sourceKey': source_key, 'snapshotKey': snapshot_key,
                'gaps': [e for e in entries if not artifact_ready(e)]}
    finally:
        if stage.exists():
            shutil.rmtree(stage)


def load_snapshot(path):
    p = safe_path(path, 'manifest.json')
    return json.loads(p.read_text(encoding='utf-8'))


def validate(path, check_directory=True):
    errors = []
    try:
        m = load_snapshot(path)
        if not isinstance(m, dict) or not isinstance(m.get('artifacts'), list) or not m['artifacts']:
            raise ValueError('invalid manifest structure')
        if not isinstance(m.get('request'), dict) or not isinstance(m.get('observation'), dict):
            raise ValueError('invalid request/observation structure')
        validate_observation(m['observation'])
        if m['version'] != VERSION or m['source'] != source_identity(m['source']):
            errors.append('unsupported or noncanonical source')
        if m['sourceKey'] != key(m['source']['provider'], m['source']):
            errors.append('source identity mismatch')
        if m['snapshotKey'] != key('snapshot', identity_payload(m)):
            errors.append('snapshot identity mismatch')
        if check_directory and Path(path).name != m['snapshotKey']:
            errors.append('snapshot directory mismatch')
        seen = set()
        for e in m['artifacts']:
            if not isinstance(e, dict) or e.get('status') not in STATUSES or not isinstance(e.get('required'), bool):
                raise ValueError('invalid artifact metadata')
            text(e.get('role'), 'artifact role')
            if e['status'] == 'empty' and e['role'] not in EMPTY_ROLES:
                errors.append('invalid empty evidence role')
            if e['status'] != 'available':
                if e.get('path') is not None:
                    errors.append('unavailable artifact claims a file')
                continue
            identity = artifact_identity(e['path'])
            if identity == 'manifest.json':
                errors.append('reserved manifest artifact path')
            p = safe_path(path, e['path'])
            if identity in seen:
                errors.append('duplicate artifact path alias')
            seen.add(identity)
            data = p.read_bytes()
            if not data or len(data) != e['size'] or hashlib.sha256(data).hexdigest() != e['sha256']:
                errors.append('artifact integrity mismatch: ' + e['path'])
    except (OSError, ValueError, KeyError, TypeError) as exc:
        errors.append('invalid snapshot: ' + type(exc).__name__)
    return errors


def assess(path, intent='auto', request=None, required=(), revision=None, task=None):
    if intent not in ('auto', 'refresh', 'offline'):
        raise ValueError('unknown cache intent')
    errors = validate(path)
    if errors:
        return {'reuse': False, 'reason': 'invalid', 'gaps': errors}
    m = load_snapshot(path)
    if request is not None and digest(request) != digest(m['request']):
        return {'reuse': False, 'reason': 'request-changed'}
    needed = set(required) | {e['role'] for e in m['artifacts'] if e['required']}
    ready = {e['role'] for e in m['artifacts'] if artifact_ready(e)}
    # Every requested slice must be ready; one available structure slice cannot
    # conceal another required/explicitly requested slice of the same role.
    incomplete = [e for e in m['artifacts'] if not artifact_ready(e) and (e['required'] or e['role'] in set(required))]
    gaps = sorted((needed - ready) | {e['role'] for e in incomplete})
    if gaps:
        return {'reuse': False, 'reason': 'missing-evidence', 'gaps': gaps, 'incompleteArtifacts': incomplete}
    if intent == 'refresh':
        return {'reuse': False, 'reason': 'refresh-requested'}
    if intent == 'offline':
        return {'reuse': True, 'reason': 'offline-unverified', 'freshness': 'unknown'}
    obs = m['observation']
    if task and task == obs.get('task'):
        return {'reuse': True, 'reason': 'pinned-within-task'}
    if revision and obs.get('method') == 'revision' and revision == obs.get('after') and obs.get('coversDependencies') is True:
        return {'reuse': True, 'reason': 'revision-checked'}
    return {'reuse': False, 'reason': 'reread-required', 'freshness': 'unknown'}


def context_fingerprint(project, paths):
    return digest({name: hashlib.sha256(safe_path(project, name).read_bytes()).hexdigest() for name in sorted(set(paths))})


def bind_target(root, target, snapshot, project, paths):
    errors = validate(snapshot)
    if errors:
        raise ValueError('invalid snapshot')
    root = init_root(root)
    identity = target_identity(target)
    target_key = key(identity['state'], identity)
    record = {'target': identity, 'targetKey': target_key, 'snapshotKey': load_snapshot(snapshot)['snapshotKey'],
              'contextHash': context_fingerprint(project, paths)}
    folder = safe_path(root, 'targets/' + target_key)
    folder.mkdir(parents=True, exist_ok=True)
    with lock(root / 'locks', target_key):
        temp = folder / ('pending-' + str(os.getpid()) + '.json')
        try:
            temp.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
            os.replace(temp, folder / 'binding.json')
        finally:
            temp.unlink(missing_ok=True)
    return record


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest='command', required=True)
    k = sub.add_parser('keys'); k.add_argument('spec')
    pub = sub.add_parser('publish'); pub.add_argument('spec'); pub.add_argument('--incoming', required=True); pub.add_argument('--root', default='.design-cache')
    chk = sub.add_parser('check'); chk.add_argument('snapshot'); chk.add_argument('--intent', choices=['auto', 'refresh', 'offline'], default='auto'); chk.add_argument('--request'); chk.add_argument('--required', action='append', default=[]); chk.add_argument('--revision'); chk.add_argument('--task')
    b = sub.add_parser('bind'); b.add_argument('spec'); b.add_argument('--snapshot', required=True); b.add_argument('--project', default='.'); b.add_argument('--context', action='append', default=[]); b.add_argument('--root', default='.design-cache')
    args = p.parse_args()
    try:
        read = lambda file: json.loads(Path(file).read_text(encoding='utf-8'))
        if args.command == 'keys':
            spec = read(args.spec); result = {}
            if 'source' in spec:
                source = source_identity(spec['source']); result['sourceKey'] = key(source['provider'], source)
            if 'target' in spec:
                target = target_identity(spec['target']); result['targetKey'] = key(target['state'], target)
            if not result:
                raise ValueError('spec must contain source or target')
        elif args.command == 'publish':
            result = publish(args.root, read(args.spec), args.incoming)
        elif args.command == 'check':
            result = assess(args.snapshot, args.intent, read(args.request) if args.request else None, args.required, args.revision, args.task)
        elif args.command == 'bind':
            result = bind_target(args.root, read(args.spec)['target'], args.snapshot, args.project, args.context)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 2 if args.command == 'check' and not result['reuse'] else 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
