"""Shared v1/v2 structural schema. No approvals, filesystem or model inference."""
from __future__ import annotations
from copy import deepcopy
import re
import yaml
from plan_inputs import input_issues, resolve_inputs

VERSION = '2.0.0'
PHASES = ('change', 'apply', 'archive', 'done')
STATES = ('planned', 'ready', 'in-progress', 'blocked', 'cancelled')
SCOPES = ('auto', 'full', 'change-only', 'apply-only', 'legacy-all-change')
ID = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')

class Invalid(ValueError):
    pass

class UniqueLoader(yaml.SafeLoader):
    pass

def unique_mapping(loader, node, deep=False):
    result = {}
    for kn, vn in node.value:
        key = loader.construct_object(kn, deep=deep)
        if not isinstance(key, (str, int)) or key in result:
            raise Invalid(f'duplicate or invalid YAML key: {key!r}')
        result[key] = loader.construct_object(vn, deep=deep)
    return result
UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)

def parse(text):
    try:
        return yaml.load(text, Loader=UniqueLoader)
    except (yaml.YAMLError, RecursionError) as exc:
        raise Invalid(f'invalid YAML: {exc}') from exc

def require(condition, message):
    if not condition:
        raise Invalid(message)

def strings(value):
    return isinstance(value, list) and all(isinstance(x, str) and x.strip() for x in value)

def cycle_errors(graph):
    visiting, visited, errors = set(), set(), []
    def visit(key):
        if key in visiting:
            errors.append(f'dependency cycle: {key}')
            return
        if key in visited:
            return
        visiting.add(key)
        for dep in graph.get(key, []):
            if dep in graph:
                visit(dep)
        visiting.remove(key); visited.add(key)
    try:
        for key in graph:
            visit(key)
    except RecursionError:
        errors.append('dependency graph too deep')
    return errors

def validate(plan, strict_inputs=False, completed_ids=()):
    errors, warnings = input_issues(plan, strict_inputs)
    if errors:
        return errors, warnings
    if type(plan.get('version', 1)) is not int or plan.get('version', 1) not in (1, 2):
        errors.append('unsupported plan version; expected 1 or 2')
    groups = {}
    for key in ('requirements', 'openspec', 'batches'):
        rows = plan.get(key)
        if not isinstance(rows, list):
            errors.append(f'{key} must be a list'); continue
        group = {}
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get('id'), str) or not ID.fullmatch(row['id']):
                errors.append(f'{key}: invalid id'); continue
            if row['id'] in group:
                errors.append(f'{key}: duplicate id {row["id"]}')
            group[row['id']] = row
        groups[key] = group
    if errors:
        return errors, warnings
    entries = groups['openspec']; reqs = groups['requirements']
    for rid, r in reqs.items():
        if not isinstance(r.get('source'), str) or not r['source'].strip() or not strings(r.get('acceptance')) or not r['acceptance']:
            errors.append(f'{rid}: source and nonempty acceptance list required')
    graph = {}
    for cid, e in entries.items():
        if e.get('phase') not in PHASES:
            errors.append(f'{cid}: invalid phase')
        if e.get('phase') != 'done' and e.get('state') not in STATES:
            errors.append(f'{cid}: invalid state')
        if e.get('phase') == 'done' and e.get('state') is not None:
            errors.append(f'{cid}: done must not carry state')
        if e.get('review') not in (None, 'pending', 'approved'):
            errors.append(f'{cid}: invalid review')
        if e.get('risk', 'standard') not in ('small', 'standard', 'high'):
            errors.append(f'{cid}: invalid risk')
        if type(e.get('revision', 1)) is not int or e.get('revision', 1) < 1:
            errors.append(f'{cid}: invalid revision')
        canonical = f'openspec/changes/{cid}'
        for field, expected in (('path', canonical), ('tasks', canonical + '/tasks.md')):
            if field in e and e[field] != expected:
                errors.append(f'{cid}: {field} must be canonical {expected}')
        for field in ('requirements', 'depends_on', 'technical_design', 'impacts'):
            if not strings(e.get(field, [])):
                errors.append(f'{cid}: {field} must be a string list')
        if not strings(e.get('requirements', [])) or not strings(e.get('depends_on', [])):
            continue
        for rid in e.get('requirements', []):
            if rid not in reqs:
                errors.append(f'{cid}: unknown requirement {rid}')
        for dep in e.get('depends_on', []):
            if dep not in entries and dep not in completed_ids:
                errors.append(f'{cid}: unknown dependency {dep}')
        graph[cid] = e.get('depends_on', [])
        if 'ui_baseline' in e and (not isinstance(e['ui_baseline'], str) or not e['ui_baseline'].strip()):
            errors.append(f'{cid}: invalid ui_baseline')
    errors.extend(cycle_errors(graph))
    memberships = {}; wave_ids = {}
    for bid, b in groups['batches'].items():
        if b.get('checkpoint', 'manual') not in ('manual', 'auto'):
            errors.append(f'{bid}: checkpoint must be manual/auto')
        if 'planning_boundary' in b and (not isinstance(b['planning_boundary'], str) or not b['planning_boundary'].strip()):
            errors.append(f'{bid}: planning_boundary must be a nonempty reason/source reference')
        waves = b.get('waves')
        if not isinstance(waves, list):
            errors.append(f'{bid}: waves must be a list'); continue
        seen = set()
        for w in waves:
            if not isinstance(w, dict) or not isinstance(w.get('id'), str) or not ID.fullmatch(w['id']):
                errors.append(f'{bid}: invalid wave id'); continue
            if w['id'] in seen: errors.append(f'{bid}: duplicate wave {w["id"]}')
            seen.add(w['id'])
            if 'parallel' in w and not isinstance(w['parallel'], bool): errors.append(f'{bid}: parallel must be boolean')
            if not strings(w.get('openspec')): errors.append(f'{bid}: wave openspec must be a list'); continue
            for cid in w['openspec']:
                if cid not in entries: errors.append(f'{bid}: unknown change {cid}')
                if b.get('checkpoint') == 'auto' and entries.get(cid, {}).get('risk') == 'high':
                    errors.append(f'{bid}: high-risk batch requires manual checkpoint')
                if cid in memberships: errors.append(f'{cid}: assigned to more than one wave')
                memberships[cid] = bid
        wave_ids[bid] = seen
    for cid, e in entries.items():
        if cid not in memberships and e.get('phase') != 'done' and e.get('state') != 'cancelled':
            errors.append(f'{cid}: active change is not assigned to a wave')
    cur = plan.get('current', {})
    if not isinstance(cur, dict): errors.append('current must be a mapping')
    elif cur.get('batch'):
        if cur['batch'] not in groups['batches']: errors.append('current references unknown batch')
        elif cur.get('wave') and cur['wave'] not in wave_ids.get(cur['batch'], set()): errors.append('current references unknown wave')
    if any('behavior' in b for b in groups['batches'].values()): warnings.append('legacy batch.behavior ignored')
    return errors, warnings

def select_next(plan, scope='auto', only_batch=None, only_wave=None):
    """Select within a wave; runnable apply work can unblock a pending producer input."""
    require(scope in SCOPES, f'unknown scope {scope}')
    if only_batch:
        require(any(b['id']==only_batch for b in plan.get('batches',[])), f'unknown batch: {only_batch}')
    if scope == 'legacy-all-change':
        first = select_next(plan, 'change-only', only_batch, only_wave)
        return first if first['selected'] else select_next(plan, 'apply-only', only_batch, only_wave)
    entries = {e['id']: e for e in plan.get('openspec', [])}
    held, archives = [], []
    for b in plan.get('batches', []):
        if only_batch and b['id'] != only_batch: continue
        for w in b['waves']:
            if only_wave and w['id'] != only_wave: continue
            active = [entries[c] for c in w['openspec'] if entries[c].get('state') != 'cancelled']
            pending = [e for e in active if e['phase'] in ('change', 'apply')]
            if not pending:
                if any(e['phase'] == 'archive' for e in active): archives.append(b['id'])
                continue
            stages = ('change',) if scope=='change-only' else ('apply',) if scope=='apply-only' else ('change','apply')
            for stage in stages:
                eligible = []
                for e in pending:
                    if e['phase'] != stage: continue
                    reasons = []
                    for dep in e.get('depends_on', []):
                        d = entries.get(dep)
                        if d and (d.get('state') in ('blocked', 'cancelled') or PHASES.index(d['phase']) < (1 if stage == 'change' else 2)):
                            reasons.append(f'dependency {dep} not ready')
                    if e.get('state') == 'blocked': reasons.append('blocked')
                    if stage == 'apply' and e.get('review') != 'approved': reasons.append('review pending')
                    if reasons: held.append({'id': e['id'], 'reason': '; '.join(reasons)})
                    else:
                        row = deepcopy(e); row['inputs'] = resolve_inputs(plan, e)
                        row.setdefault('path', f'openspec/changes/{e["id"]}'); row.setdefault('tasks', row['path'] + '/tasks.md')
                        eligible.append(row)
                if eligible:
                    return {'selected': {'batch': b['id'], 'wave': w['id'], 'stage': stage, 'goal': b.get('goal', ''), 'parallel': bool(w.get('parallel')) and len(eligible)>1, 'entries': eligible}, 'held': held, 'archive_ready': sorted(set(archives))}
            if scope == 'auto': return {'selected': None, 'held': held, 'archive_ready': sorted(set(archives))}
    return {'selected': None, 'held': held, 'archive_ready': sorted(set(archives))}
