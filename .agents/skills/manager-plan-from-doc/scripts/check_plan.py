#!/usr/bin/env python3
"""Read-only structural checks for the current Manager plan. Never executes tasks."""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path, PurePosixPath

import yaml


class UniqueLoader(yaml.SafeLoader):
    """Reject duplicate keys rather than silently losing plan data."""


def unique_mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if not isinstance(key, str) or key in result:
            raise ValueError(f"duplicate or non-string YAML key: {key!r}")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)
ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*\Z")
VERIFIED = ("code-verified", "archived")


def validate(plan: object) -> list[str]:
    """Validate shape, references, two dependency DAGs and truthful state labels.

    No file existence, source authority, human identity or test outcome is inferred.
    """
    errors: list[str] = []

    def check(ok, message):
        if not ok:
            errors.append(message)

    def text(value):
        return isinstance(value, str) and bool(value.strip())

    def texts(value):
        return isinstance(value, list) and all(text(x) for x in value)

    def rows(key, fields):
        values = plan.get(key, [])
        if not isinstance(values, list):
            errors.append(f"{key}: expected list")
            return {}
        found = {}
        for row in values:
            if not isinstance(row, dict):
                errors.append(f"{key}: expected object")
                continue
            identifier = row.get("id")
            if not isinstance(identifier, str) or not ID.fullmatch(identifier):
                errors.append(f"{key}: invalid id")
                continue
            check(identifier not in found, f"{key}: duplicate id {identifier}")
            check(set(row) <= fields, f"{identifier}: unsupported fields {set(row) - fields}")
            found[identifier] = row
        return found

    def refs(row, field, known, required=False):
        values = row.get(field, [])
        if not texts(values):
            errors.append(f"{row['id']}.{field}: expected string list")
            return []
        check(not required or bool(values), f"{row['id']}.{field}: must not be empty")
        check(len(set(values)) == len(values), f"{row['id']}.{field}: duplicate references")
        check(set(values) <= set(known), f"{row['id']}.{field}: unknown references {set(values) - set(known)}")
        return [x for x in values if x in known]

    def ancestors(graph, origin):
        pending = list(graph.get(origin, [])); seen = set()
        while pending:
            node = pending.pop()
            if node not in seen:
                seen.add(node); pending.extend(graph.get(node, []))
        return seen

    if not isinstance(plan, dict):
        return ["plan must be an object"]
    check(set(plan) <= {"requirements", "inputs", "openspec", "batches"}, "unsupported plan fields")
    for key in ("requirements", "openspec", "batches"):
        check(key in plan, f"missing {key}")
    requirements = rows("requirements", {"id", "source", "code_acceptance", "human_acceptance"})
    inputs = rows("inputs", {"id", "source", "purpose", "required", "scope"})
    changes = rows("openspec", {"id", "requirements", "depends_on", "status", "technical_design", "input_refs", "note", "archive"})
    batches = rows("batches", {"id", "depends_on", "changes", "checkpoint", "status", "human_acceptance", "decision_ref", "checks", "note", "planning_boundary"})
    for row in requirements.values():
        check(text(row.get("source")), f"{row['id']}: source required")
        check(texts(row.get("code_acceptance")) and bool(row.get("code_acceptance")), f"{row['id']}: code_acceptance required")
        check(texts(row.get("human_acceptance", [])), f"{row['id']}: invalid human_acceptance")
    for row in inputs.values():
        check(text(row.get("source")), f"{row['id']}: source required")
        check(row.get("purpose") in ("contract", "reference"), f"{row['id']}: invalid purpose")
        check(type(row.get("required")) is bool, f"{row['id']}: required must be boolean")
        check(texts(row.get("scope", [])), f"{row['id']}: scope must be a string list")
    graph, batch_graph, membership, coverage, change_requirements = {}, {}, {}, set(), {}
    for cid, row in changes.items():
        graph[cid] = refs(row, "depends_on", changes)
        change_requirements[cid] = refs(row, "requirements", requirements, required=True)
        coverage.update(change_requirements[cid])
        refs(row, "input_refs", inputs)
        check(texts(row.get("technical_design", [])), f"{cid}: invalid technical_design")
        check(row.get("status") in ("planned", "in-progress", "code-verified", "blocked", "archived"), f"{cid}: invalid status")
        if row.get("status") == "archived":
            path = PurePosixPath(str(row.get("archive", "")))
            check(path.parts[:3] == ("openspec", "changes", "archive") and len(path.parts) >= 4 and ".." not in path.parts, f"{cid}: archive path required")
    check(coverage == set(requirements), f"requirements without Change coverage: {set(requirements) - coverage}")
    for bid, row in batches.items():
        batch_graph[bid] = refs(row, "depends_on", batches)
        members = refs(row, "changes", changes, required=True)
        for cid in members:
            check(cid not in membership, f"{cid}: belongs to multiple batches")
            membership[cid] = bid
        check(row.get("checkpoint") in ("auto", "manual"), f"{bid}: invalid checkpoint")
        check(row.get("status") in ("planned", "in-progress", "code-verified", "blocked"), f"{bid}: invalid status")
        human = row.get("human_acceptance")
        check(human in ("pending", "accepted", "not-required"), f"{bid}: invalid human_acceptance")
        needs_human = row.get("checkpoint") == "manual" or any(requirements[rid].get("human_acceptance") for cid in members for rid in change_requirements[cid])
        check(not needs_human or human != "not-required", f"{bid}: required human acceptance cannot be omitted")
        if human == "accepted":
            check(text(row.get("decision_ref")), f"{bid}: accepted needs a real decision reference")
            check(row.get("status") == "code-verified", f"{bid}: accepted before code verification")
        if row.get("status") == "code-verified":
            check(all(changes[cid].get("status") in VERIFIED for cid in members), f"{bid}: unfinished changes")
        if any(changes[cid].get("status") == "archived" for cid in members):
            check(row.get("status") == "code-verified", f"{bid}: archive requires verified batch")
        if needs_human and human != "accepted":
            check(not any(changes[cid].get("status") == "archived" for cid in members), f"{bid}: cannot archive before required human acceptance")
        check(texts(row.get("checks", [])), f"{bid}: invalid checks")
    check(set(membership) == set(changes), f"changes without batch: {set(changes) - set(membership)}")
    for label, dag in (("Change", graph), ("Batch", batch_graph)):
        for node in dag:
            check(node not in ancestors(dag, node), f"{label} dependency cycle at {node}")
    for cid, dependencies in graph.items():
        bid = membership.get(cid)
        for dependency in dependencies:
            owner = membership.get(dependency)
            check(not bid or not owner or owner == bid or owner in ancestors(batch_graph, bid), f"{cid}: missing batch dependency on {owner}")
            if changes[cid].get("status") in VERIFIED:
                check(changes[dependency].get("status") in VERIFIED, f"{cid}: unverified dependency {dependency}")
        if changes[cid].get("status") in VERIFIED and bid:
            check(all(batches[b].get("status") == "code-verified" for b in ancestors(batch_graph, bid)), f"{cid}: unverified prerequisite batch")
    return list(dict.fromkeys(errors))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path)
    args = parser.parse_args(argv)
    try:
        errors = validate(yaml.load(args.plan.read_text(encoding="utf-8"), Loader=UniqueLoader))
    except (OSError, ValueError, yaml.YAMLError, RecursionError) as exc:
        errors = [str(exc)]
    print(json.dumps({"ok": not errors, "errors": errors, "scope": "structure-only"}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
