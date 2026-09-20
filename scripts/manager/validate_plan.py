#!/usr/bin/env python3
"""Validate the Manager index, dependency graph and review/archive evidence.

Run through `make docs` for the pinned, isolated PyYAML tooling environment.
"""
from __future__ import annotations

from pathlib import Path
import re
import sys

import yaml


class UniqueKeyLoader(yaml.SafeLoader):
    """Do not silently accept a last-wins duplicate mapping key."""


def mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if not isinstance(key, str) or key in result:
            raise ValueError(f"invalid or duplicate mapping key: {key!r}")
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueKeyLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)


def load_plan(path):
    if not path.is_file():
        raise ValueError(f"missing file: {path}")
    value = yaml.load(path.read_text(encoding="utf-8"), Loader=UniqueKeyLoader)
    if not isinstance(value, dict):
        raise ValueError("plan must be a mapping")
    return value


def validate_plan(path: Path) -> list[str]:
    root = path.resolve().parents[1]
    try:
        plan = load_plan(path)
    except (ValueError, yaml.YAMLError, OSError) as exc:
        return [str(exc)]
    errors = []

    def index(value, label):
        if not isinstance(value, list):
            errors.append(f"{label} must be a list")
            return {}
        found = {}
        for item in value:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str):
                errors.append(f"{label}: each item needs a string id")
                continue
            if item["id"] in found:
                errors.append(f"{label}: duplicate id {item['id']}")
            found[item["id"]] = item
        return found

    def reference(value, label, directory=False):
        if not isinstance(value, str):
            errors.append(f"{label}: path must be a string")
            return None
        target = (root / value).resolve()
        if not target.is_relative_to(root):
            errors.append(f"{label}: path escapes repository")
            return None
        if not (target.is_dir() if directory else target.is_file()):
            errors.append(f"{label}: missing path {value}")
            return None
        return target

    def refs(value, label):
        if not isinstance(value, list) or any(not isinstance(x, str) for x in value):
            errors.append(f"{label}: references must be a string list")
            return []
        if len(value) != len(set(value)):
            errors.append(f"{label}: duplicate reference")
        return value

    requirements = index(plan.get("requirements"), "requirements")
    changes = index(plan.get("openspec"), "openspec")
    batches = index(plan.get("batches"), "batches")
    # An untouched template has no update date or task state to inherit.
    pristine = (
        all(plan.get(key) == [] for key in ("requirements", "openspec", "batches"))
        and plan.get("current") == {"title": "", "batch": None, "wave": None, "next": ""}
        and "updated_at" in plan
    )
    if not plan.get("updated_at") and not pristine:
        errors.append("missing updated_at")
    for rid, req in requirements.items():
        source = reference(req.get("source"), rid)
        if source and rid not in source.read_text(encoding="utf-8"):
            errors.append(f"{rid}: requirement not defined in its own source")
    graph = {}
    phases = {"planned": "plan", "in_progress": "apply", "blocked": None,
              "ready_for_review": "verify", "archived": "archive"}
    for cid, change in changes.items():
        for rid in refs(change.get("requirements"), f"{cid}.requirements"):
            if rid not in requirements:
                errors.append(f"{cid}: undefined requirement {rid}")
        directory = reference(change.get("path"), f"{cid}.path", directory=True)
        task_path = reference(change.get("tasks"), f"{cid}.tasks")
        if directory and task_path and task_path != directory / "tasks.md":
            errors.append(f"{cid}: tasks must use the change's tasks.md")
        state = change.get("state")
        if state not in phases:
            errors.append(f"{cid}: invalid state")
        elif phases[state] and change.get("phase") != phases[state]:
            errors.append(f"{cid}: phase/state mismatch")
        if directory:
            archived = "archive" in directory.relative_to(root).parts
            if archived != (state == "archived"):
                errors.append(f"{cid}: archive path/state mismatch")
        inputs = index(change.get("inputs", []), f"{cid}.inputs")
        for item in inputs.values():
            reference(item.get("source"), f"{cid}.inputs.{item['id']}")
        deps = refs(change.get("depends_on"), f"{cid}.depends_on")
        graph[cid] = deps
        for dep in deps:
            if dep not in changes:
                errors.append(f"{cid}: undefined dependency {dep}")
        if state in {"ready_for_review", "archived"} and task_path:
            checks = re.findall(r"^\s*- \[([ xX])\]", task_path.read_text(), flags=re.M)
            if not checks or any(c == " " for c in checks):
                errors.append(f"{cid}: review/archive requires completed tasks")
            if directory and not (directory / "verification.md").is_file():
                errors.append(f"{cid}: missing verification.md")
    visited, visiting = set(), set()
    def visit(cid):
        if cid in visiting:
            errors.append(f"dependency cycle at {cid}")
            return
        if cid in visited:
            return
        visiting.add(cid)
        for dep in graph.get(cid, []):
            visit(dep)
        visiting.remove(cid)
        visited.add(cid)
    for cid in graph:
        visit(cid)
    waves_by_batch = {}
    for bid, batch in batches.items():
        waves = index(batch.get("waves"), f"{bid}.waves")
        waves_by_batch[bid] = waves
        for wid, wave in waves.items():
            for cid in refs(wave.get("openspec"), f"{wid}.openspec"):
                if cid not in changes:
                    errors.append(f"{wid}: unknown change {cid}")
    current = plan.get("current")
    if not isinstance(current, dict):
        errors.append("missing current mapping")
    else:
        for key in ("title", "batch", "wave", "next"):
            if key not in current:
                errors.append(f"missing current.{key}")
        bid, wid = current.get("batch"), current.get("wave")
        if (bid is None) != (wid is None):
            errors.append("current batch and wave must both be set or both be null")
        if bid is not None:
            if bid not in batches:
                errors.append(f"current.batch references missing batch: {bid}")
            elif wid not in waves_by_batch[bid]:
                errors.append(f"current.wave not in current.batch: {wid}")
            else:
                for cid in refs(waves_by_batch[bid][wid].get("openspec"), "current wave"):
                    if changes.get(cid, {}).get("state") == "archived":
                        errors.append(f"current wave contains archived change: {cid}")
    return errors


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("manager/plan.yaml")
    errors = validate_plan(path)
    if errors:
        print("Manager plan invalid:\n" + "\n".join(errors), file=sys.stderr)
        return 1
    print(f"Manager plan OK: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
