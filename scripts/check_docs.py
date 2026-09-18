#!/usr/bin/env python3
"""Check active navigation and traceability, not semantic architecture correctness."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def active_files(root):
    files = set(root.glob("*.md"))
    for folder in ("docs", "openspec/changes", "openspec/specs", "repairs", ".agents/skills", ".claude/skills", ".codex/skills"):
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
    # Share the same semantic validator used by the Manager CLI.
    from manager.validate_plan import validate_plan
    return validate_plan(root / "manager/plan.yaml")


def hygiene_errors(root):
    errors = []
    legacy = (
        "frontend-agent-template", "backend-agent-template", "company-lens", "ai-server",
        "examples/personal-bookkeeping", "scripts/ralph", "manager/roles.yaml",
        ".codex/skills", "frontend/.codex", "frontend/.claude",
        "frontend/docs", "backend/docs", "ai-service/docs",
        "frontend/manager", "frontend/openspec", "backend/openspec", "ai-service/openspec",
    )
    for name in legacy:
        if (root / name).exists():
            errors.append(f"legacy or duplicate root reintroduced: {name}")
    skills = {}
    for folder in (".agents/skills", ".codex/skills", ".claude/skills"):
        for skill in (root / folder).glob("*/SKILL.md"):
            name = skill.parent.name
            if name in skills:
                errors.append(f"duplicate skill: {name}")
            skills[name] = skill
    stale = re.compile(r"(?<![\w/-])(?:docs/prd/|docs/frontend/|docs/backend/|app/core/deps\.py)")
    for path in active_files(root):
        rel = path.relative_to(root)
        # Review records may intentionally name removed paths; execution guidance may not.
        if path.name in {"AGENTS.md", "CLAUDE.md", "SKILL.md"} or str(rel).startswith("docs/engineering/"):
            if stale.search(path.read_text()):
                errors.append(f"{rel}: stale execution-guidance path")
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
    errors.extend(hygiene_errors(root))
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
