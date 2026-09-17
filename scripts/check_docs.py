#!/usr/bin/env python3
"""Check active navigation and traceability, not semantic architecture correctness."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def active_files(root):
    files = set(root.glob("*.md"))
    for folder in ("docs", "openspec/changes", "repairs"):
        files.update((root / folder).rglob("*.md"))
    for service in ("frontend", "backend", "ai-service"):
        files.update((root / service).glob("*.md"))
    return sorted(p for p in files if "archive" not in p.relative_to(root).parts)


def link_errors(root, path):
    errors = []
    text = re.sub(r"```.*?```", "", path.read_text(), flags=re.S)
    for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)(?:\s+\"[^\"]*\")?\)", text):
        parsed = urlsplit(target.strip("<>"))
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        destination = (path.parent / unquote(parsed.path)).resolve()
        if not destination.is_relative_to(root.resolve()):
            errors.append(f"{path.relative_to(root)}: link escapes repository: {target}")
        elif not destination.exists():
            errors.append(f"{path.relative_to(root)}: broken link: {target}")
    return errors


def plan_errors(root):
    path = root / "manager/plan.yaml"
    if not path.exists():
        return ["missing manager/plan.yaml"]
    text = path.read_text()
    errors = []
    for ref in re.findall(r"^\s+(?:source|path|tasks):\s*([^\s#]+)", text, flags=re.M):
        ref = ref.strip("'\"")
        if not (root / ref).exists():
            errors.append(f"manager/plan.yaml: missing source/path/tasks: {ref}")
    defined = set(re.findall(r"^\s+- id: (REQ-[A-Z0-9-]+)\s*$", text, flags=re.M))
    mentioned = set(re.findall(r"\bREQ-[A-Z0-9-]+\b", text))
    for ref in mentioned - defined:
        errors.append(f"manager/plan.yaml: undefined requirement: {ref}")
    products = "\n".join(p.read_text() for p in (root / "docs/product").rglob("*.md"))
    for ref in defined:
        if ref not in products:
            errors.append(f"requirement not defined in product source: {ref}")
    return errors


def validate(root):
    errors = []
    for path in active_files(root):
        errors.extend(link_errors(root, path))
    for name in ("AGENTS.md", "frontend/AGENTS.md", "backend/AGENTS.md", "ai-service/AGENTS.md"):
        path = root / name
        if not path.exists():
            errors.append(f"missing {name}")
        elif len(path.read_text().splitlines()) > 60:
            errors.append(f"{name}: routing entry exceeds 60 lines; move details into docs")
    for legacy in ("frontend/docs", "backend/docs", "ai-service/docs", "frontend/manager", "frontend/openspec"):
        if (root / legacy).exists():
            errors.append(f"duplicate documentation/workflow root: {legacy}")
    errors.extend(plan_errors(root))
    return errors


def main():
    errors = validate(ROOT)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Documentation navigation and traceability OK ({len(active_files(ROOT))} active Markdown files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
