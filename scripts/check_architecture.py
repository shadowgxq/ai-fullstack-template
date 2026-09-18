#!/usr/bin/env python3
"""Enforce import and transaction boundaries with AST; not a full semantic proof."""
import ast
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]


def validate(root):
    errors = []
    for service, source in (("backend", "app"), ("ai-service", "src/ai_service")):
        for path in (root / service / source).rglob("*.py"):
            rel = path.relative_to(root)
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(rel))
            local = path.relative_to(root / service / source).parts
            banned = ["ai_service"] if service == "backend" else ["app"]
            if service == "backend":
                if local[0] == "core":
                    banned += ["app.api", "app.services", "app.repositories", "app.models"]
                if local[0] == "repositories":
                    banned += ["app.api", "app.services"]
            elif local[0] in {"agent_core", "application"}:
                banned += ["ai_service.infrastructure", "ai_service.workflows", "ai_service.api",
                           "fastapi", "psycopg", "langgraph"]
            for node in ast.walk(tree):
                imports = []
                if isinstance(node, ast.Import):
                    imports = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom):
                    # Resolve relative imports as well as "from app import services".
                    package = list(path.relative_to(root / service / ("src" if service == "ai-service" else "")).parent.parts)
                    if node.level:
                        package = package[:len(package) - node.level + 1]
                        base = ".".join(package + ([node.module] if node.module else []))
                    else:
                        base = node.module or ""
                    imports = [base] + [f"{base}.{a.name}" for a in node.names]
                for name in imports:
                    if any(name == p or name.startswith(p + ".") for p in banned):
                        errors.append(f"{rel}:{node.lineno}: forbidden dependency {name}")
                if (service == "backend" and local[0] == "repositories"
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
