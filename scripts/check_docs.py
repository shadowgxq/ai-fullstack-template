#!/usr/bin/env python3
"""Check active navigation and traceability, not semantic architecture correctness."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

from check_sources import managed_paths, manager_errors

ROOT = Path(__file__).resolve().parents[1]


def active_files(root):
    files = set(root.glob("*.md"))
    for folder in ("docs", "openspec/changes", "openspec/specs", "repairs", "manager", ".agents/skills", ".claude/skills", ".codex/skills"):
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


def prose_errors(root, path):
    """Detect obvious chat residue in long-lived docs, not legitimate prompts."""
    rel = path.relative_to(root)
    if path.name in {"AGENTS.md", "CLAUDE.md", "SKILL.md"}:
        return []
    if "templates" in rel.parts or "archive" in rel.parts:
        return []
    if rel.parts[0] != "docs" and not (
        path.name == "README.md" and len(rel.parts) <= 2
    ):
        return []
    residue = re.compile(
        r"(?:我(?:会|将|已经|建议|帮你)|你(?:刚才|之前|提供的|指出的)"
        r"|按(?:照)?[你您]的(?:要求|反馈)|本轮(?:仅参考|修改|清理|补充)"
        r"|本次维护(?:范围|记录)|上一(?:版|轮)\s*PR"
        r"|(?:cite|filecite|memcite)|^\s*(?:User|Assistant|用户|助手)\s*[:：])"
    )
    errors, fence = [], None
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        marker = re.match(r"^\s*(`{3,}|~{3,})(.*)$", line)
        if marker:
            marks, rest = marker.groups()
            if fence is None:
                fence = marks
            elif marks[0] == fence[0] and len(marks) >= len(fence) and not rest.strip():
                fence = None
            continue
        if fence is None and residue.search(line):
            errors.append(f"{rel}:{number}: conversation residue in long-lived documentation")
    return errors


def hygiene_errors(root):
    errors = []
    legacy = (
        "frontend-agent-template", "backend-agent-template", "company-lens", "ai-server",
        "examples/personal-bookkeeping", "scripts/ralph",
        ".codex/skills", "frontend/.codex", "frontend/.claude",
        "frontend/docs", "backend/docs", "ai-service/docs",
        "frontend/manager", "frontend/openspec", "backend/openspec", "ai-service/openspec",
    )
    for name in legacy:
        if (root / name).exists():
            errors.append(f"legacy or duplicate root reintroduced: {name}")
    changes = root / "openspec/changes"
    for archived in (changes / "archive").glob("*"):
        if archived.is_dir():
            change_id = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", archived.name)
            if (changes / change_id).exists():
                errors.append(f"archived change still present in active directory: {change_id}")
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
        if str(rel) not in managed_paths(root) and (path.name in {"AGENTS.md", "CLAUDE.md", "SKILL.md"} or str(rel).startswith("docs/engineering/")):
            if stale.search(path.read_text()):
                errors.append(f"{rel}: stale execution-guidance path")
    return errors


def validate(root):
    errors = []
    for path in active_files(root):
        errors.extend(link_errors(root, path))
        errors.extend(prose_errors(root, path))
    for name in ("AGENTS.md", "frontend/AGENTS.md", "backend/AGENTS.md", "ai-service/AGENTS.md"):
        path = root / name
        if not path.exists():
            errors.append(f"missing {name}")
        elif len(path.read_text().splitlines()) > 60:
            errors.append(f"{name}: routing entry exceeds 60 lines; move details into docs")
    errors.extend(hygiene_errors(root))
    errors.extend(plan_errors(root))
    errors.extend(manager_errors(root))
    return errors


def main():
    errors = validate(ROOT)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Documentation navigation, prose and traceability OK ({len(active_files(ROOT))} active Markdown files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
