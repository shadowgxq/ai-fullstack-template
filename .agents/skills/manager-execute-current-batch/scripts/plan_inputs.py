"""Shared input definitions, explicit consumer references and conservative migration.

No filesystem reads, source discovery, URL fetching or lifecycle mutations occur here.
Project guidance is diagnosed, never silently deleted by the normalizer.
"""
from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
import re

import yaml

ID = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
# These kinds explicitly describe project guidance, not change deliverables.
# Paths alone (e.g. docs/engineering/) are not enough to classify an input.
GUIDANCE_KINDS = frozenset({
    'architecture-guidance', 'documentation-guidance', 'frontend-standard',
    'component-guidance', 'file-organization', 'ui-state-guidance',
    'project-guidance', 'coding-standard', 'source-foundation',
})


class InputError(ValueError):
    """An input definition or reference cannot be interpreted unambiguously."""


def definition_errors(items: object, label: str) -> list[str]:
    if not isinstance(items, list):
        return [f'{label}: inputs must be a list']
    errors, seen = [], set()
    for i, item in enumerate(items):
        location = f'{label}[{i}]'
        if not isinstance(item, dict):
            errors.append(f'{location}: input must be a mapping')
            continue
        if 'input_refs' in item:
            errors.append(f'{location}: nested input_refs are not supported')
        for key in ('id', 'kind'):
            if not isinstance(item.get(key), str) or not ID.fullmatch(item[key]):
                errors.append(f'{location}: {key} must be non-empty kebab-case')
        iid = item.get('id')
        if isinstance(iid, str):
            if iid in seen:
                errors.append(f'{location}: duplicate input id {iid}')
            seen.add(iid)
        if not isinstance(item.get('source'), str) or not item['source'].strip():
            errors.append(f'{location}: source must be a non-empty path or URI')
        if not isinstance(item.get('required'), bool):
            errors.append(f'{location}: required must be boolean')
        if 'scope' in item and (not isinstance(item['scope'], list) or any(
            not isinstance(s, str) or not s.strip() for s in item['scope']
        )):
            errors.append(f'{location}: scope must be a list of non-empty locators')
        if 'snapshot' in item and (not isinstance(item['snapshot'], str) or not item['snapshot'].strip()):
            errors.append(f'{location}: snapshot must be a non-empty path')
    return errors


def _profile(item: dict) -> str:
    # Preserve all metadata and scope ordering; do not combine different profiles.
    return yaml.safe_dump({k: v for k, v in item.items() if k != 'id'}, sort_keys=True, allow_unicode=True)


def input_issues(plan: dict, strict: bool = False) -> tuple[list[str], list[str]]:
    """Structural errors always block; policy warnings block new-plan strict checks."""
    if not isinstance(plan, dict):
        return ['plan must be a mapping'], []
    errors, warnings = [], []
    shared = plan.get('inputs', [])
    errors.extend(definition_errors(shared, 'inputs'))
    entries = plan.get('openspec', [])
    if not isinstance(entries, list):
        return errors + ['openspec must be a list'], warnings
    global_ids = {x['id'] for x in shared if isinstance(x, dict) and isinstance(x.get('id'), str)} if isinstance(shared, list) else set()
    change_ids = set()
    for index, e in enumerate(entries):
        if not isinstance(e, dict) or not isinstance(e.get('id'), str):
            errors.append(f'openspec[{index}]: entry requires a string id')
            continue
        cid = e['id']
        if cid in change_ids:
            errors.append(f'duplicate change id {cid}')
        change_ids.add(cid)
        local = e.get('inputs', [])
        errors.extend(definition_errors(local, f'{cid}.inputs'))
        refs = e.get('input_refs', [])
        if not isinstance(refs, list) or any(not isinstance(r, str) or not ID.fullmatch(r) for r in refs):
            errors.append(f'{cid}.input_refs must be a list of input ids')
            continue
        if len(refs) != len(set(refs)):
            errors.append(f'{cid}: duplicate input_refs')
        for r in refs:
            if r not in global_ids:
                errors.append(f'{cid}: unknown input_ref {r}; only top-level inputs are referenceable')
        if isinstance(local, list):
            for item in local:
                if isinstance(item, dict) and isinstance(item.get('id'), str) and item['id'] in global_ids:
                    errors.append(f'{cid}: local input {item["id"]} shadows a top-level definition; use input_refs, not overrides')
    if errors:
        return errors, warnings

    records = [('plan', item) for item in shared]
    records.extend((e['id'], item) for e in entries for item in e.get('inputs', []))
    by_id, by_profile = defaultdict(list), defaultdict(list)
    profiles_by_object = {id(item): _profile(item) for _, item in records}
    for owner, item in records:
        by_id[item['id']].append((owner, item))
        by_profile[profiles_by_object[id(item)]].append((owner, item))
        if item['kind'] in GUIDANCE_KINDS:
            warnings.append(f'{owner}/{item["id"]}: project guidance belongs in AGENTS.md/role context, not change inputs')
    for iid, group in by_id.items():
        if len(group) > 1:
            profiles = {profiles_by_object[id(item)] for _, item in group}
            if len(profiles) == 1:
                warnings.append(f'{iid}: repeated definition; lift once to top-level inputs and reference from consumers')
            else:
                warnings.append(f'{iid}: different input profiles; keep legacy scopes intact and assign explicit variant ids before sharing')
    for group in by_profile.values():
        aliases = sorted({item['id'] for _, item in group})
        if len(aliases) > 1:
            warnings.append(f'{", ".join(aliases)}: identical sources/profiles have different ids; review aliases before deduplication')
    used = {r for e in entries for r in e.get('input_refs', [])}
    for iid in sorted(global_ids - used):
        warnings.append(f'{iid}: unused top-level input; registry does not imply inheritance')

    reqs = {r.get('id'): r for r in plan.get('requirements', []) if isinstance(r, dict) and isinstance(r.get('id'), str)} if isinstance(plan.get('requirements', []), list) else {}
    registry = {x['id']: x for x in shared}
    for e in entries:
        typed = e.get('technical_design', [])
        typed_sources = {s for s in typed if isinstance(s, str)} if isinstance(typed, list) else set()
        if isinstance(e.get('ui_baseline'), str):
            typed_sources.add(e['ui_baseline'])
        req_refs = e.get('requirements', [])
        if isinstance(req_refs, list):
            typed_sources.update(reqs[r]['source'] for r in req_refs if isinstance(r, str) and r in reqs and isinstance(reqs[r].get('source'), str))
        effective = [registry[r] for r in e.get('input_refs', [])] + e.get('inputs', [])
        for item in effective:
            if item['source'] in typed_sources:
                warnings.append(f'{e["id"]}/{item["id"]}: source already supplied by requirements/technical_design/ui_baseline; do not duplicate it')
    warnings = list(dict.fromkeys(warnings))
    return (warnings, []) if strict else ([], warnings)


def _require_valid(plan: dict) -> None:
    errors, _ = input_issues(plan)
    if errors:
        raise InputError('; '.join(errors))


def _expanded(registry: dict, entry: dict) -> list[dict]:
    return [registry[iid] for iid in entry.get('input_refs', [])] + entry.get('inputs', [])


def resolve_inputs(plan: dict, entry: dict) -> list[dict]:
    """Expand only this consumer's references; return isolated runtime copies."""
    _require_valid(plan)
    if entry not in plan.get('openspec', []):
        raise InputError('entry is not in the supplied plan')
    registry = {item['id']: item for item in plan.get('inputs', [])}
    return deepcopy(_expanded(registry, entry))


def consumers(plan: dict, input_id: str) -> list[str]:
    _require_valid(plan)
    return [e['id'] for e in plan.get('openspec', []) if input_id in e.get('input_refs', []) or any(i['id'] == input_id for i in e.get('inputs', []))]


def normalize_inputs(plan: dict) -> tuple[dict, dict]:
    """Hoist identical repeated ids only. Never drop guidance or rename stable ids.

Different scopes, optionality, snapshots and unknown metadata remain separate.
This is a structural preview, not approval to change a running plan.
"""
    _require_valid(plan)
    result = deepcopy(plan)
    entries = result.get('openspec', [])
    groups = defaultdict(list)
    for e in entries:
        for item in e.get('inputs', []):
            groups[item['id']].append((e['id'], item))
    promoted = []
    terminal_ids = {e['id'] for e in entries if e.get('phase') == 'done' or e.get('state') == 'cancelled'}
    for iid, group in groups.items():
        # Completed/cancelled plan records keep their original inline snapshots.
        if any(owner in terminal_ids for owner, _ in group):
            continue
        if len(group) > 1 and all(item == group[0][1] for _, item in group):
            result.setdefault('inputs', []).append(deepcopy(group[0][1]))
            promoted.append(iid)
    promoted_set = set(promoted)
    for e in entries:
        original = e.get('inputs', [])
        moved = [item['id'] for item in original if item['id'] in promoted_set]
        if moved:
            e.setdefault('input_refs', []).extend(moved)
            remaining = [item for item in original if item['id'] not in promoted_set]
            if remaining:
                e['inputs'] = remaining
            else:
                e.pop('inputs', None)
    _require_valid(result)
    # Verify per-consumer content before returning; list ordering carries no precedence.
    before_registry = {i['id']: i for i in plan.get('inputs', [])}
    after_registry = {i['id']: i for i in result.get('inputs', [])}
    for before, after in zip(plan.get('openspec', []), entries):
        if {i['id']: i for i in _expanded(before_registry, before)} != {i['id']: i for i in _expanded(after_registry, after)}:
            raise InputError(f'{before["id"]}: normalization changed effective inputs')
    count = lambda p: len(p.get('inputs', [])) + sum(len(e.get('inputs', [])) for e in p.get('openspec', []))
    return result, {
        'promoted': promoted,
        'definitions_before': count(plan),
        'definitions_after': count(result),
        'consumers': {iid: [e['id'] for e in entries if iid in e.get('input_refs', [])] for iid in promoted},
        'warnings': input_issues(result)[1],
    }
