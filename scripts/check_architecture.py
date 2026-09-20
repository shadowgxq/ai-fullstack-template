#!/usr/bin/env python3
"""Check static import and transaction boundaries, not runtime authorization."""
import ast
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

# Internal dependencies point inward. Composition roots are checked separately.
AI_DEPENDENCIES = {
    "agent_core": {"agent_core"},
    "application": {"application", "agent_core"},
    "workflows": {"workflows", "agent_core"},
    "infrastructure": {"infrastructure", "agent_core", "config"},
    "api": {"api", "application", "agent_core"},
}


def imported_names(node, package):
    if isinstance(node, ast.Import):
        return [alias.name for alias in node.names]
    if not isinstance(node, ast.ImportFrom):
        return []
    if node.level:
        parent = package[:len(package) - node.level + 1]
        base = ".".join(parent + ([node.module] if node.module else []))
    else:
        base = node.module or ""
    # Include imported modules in "from ai_service import bootstrap" as well.
    return [base] + [f"{base}.{alias.name}" for alias in node.names]


def validate(root):
    errors = []
    for service, source in (("backend", "app"), ("ai-service", "src/ai_service")):
        service_root = root / service
        source_root = service_root / source
        paths = set(source_root.rglob("*.py"))
        if service == "backend":
            paths.update(service_root.glob("*.py"))  # Includes main.py.
        package_root = service_root / ("src" if service == "ai-service" else "")
        for path in sorted(paths):
            rel = path.relative_to(root)
            try:
                tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(rel))
            except SyntaxError as exc:
                errors.append(f"{rel}:{exc.lineno}: invalid Python syntax: {exc.msg}")
                continue
            local = (path.relative_to(source_root).parts
                     if path.is_relative_to(source_root) else (path.name,))
            layer = local[0]
            package = list(path.relative_to(package_root).parent.parts)
            banned = ["ai_service"] if service == "backend" else ["app", "backend"]
            allowed = None
            if service == "backend":
                if layer == "core":
                    banned += ["app.api", "app.services", "app.repositories", "app.models"]
                if layer == "repositories":
                    banned += ["app.api", "app.services"]
            else:
                allowed = AI_DEPENDENCIES.get(layer)
                if local == ("api", "app.py"):
                    # The API factory wires the Store, but never a workflow.
                    allowed = allowed | {"infrastructure", "config"}
                if layer in {"agent_core", "application"}:
                    banned += ["fastapi", "psycopg", "langgraph"]
            for node in ast.walk(tree):
                for name in imported_names(node, package):
                    forbidden = any(name == p or name.startswith(p + ".") for p in banned)
                    if allowed is not None and name.startswith("ai_service."):
                        forbidden |= name.split(".")[1] not in allowed
                    if forbidden:
                        errors.append(f"{rel}:{node.lineno}: forbidden dependency {name}")
                        break
                if (service == "backend" and layer == "repositories"
                        and isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                        and node.func.attr in {"commit", "rollback"}):
                    errors.append(f"{rel}:{node.lineno}: repository cannot own commit/rollback")
    return errors


if __name__ == "__main__":
    errors = validate(ROOT)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        raise SystemExit(1)
    print("Architecture import/transaction boundaries OK")
