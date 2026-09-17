#!/usr/bin/env python3
"""Generate reproducible OpenAPI snapshots in each locked service environment."""
import argparse
import difflib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def export(service: str) -> str:
    env = os.environ.copy()
    env.update(DATABASE_URL="postgresql+psycopg2://schema:schema@localhost/schema",
               SECRET_KEY="schema-generation-key-not-for-runtime",
               AI_DATABASE_URL="postgresql://schema:schema@localhost/schema",
               AI_API_KEY="schema-generation-key-not-for-runtime", AI_SCOPE="schema")
    expr = ("from main import app" if service == "backend" else
            "from ai_service.api.app import create_app; app = create_app()")
    script = expr + "; import json; print(json.dumps(app.openapi(), sort_keys=True, ensure_ascii=False, indent=2))"
    result = subprocess.run(["uv", "run", "--locked", "python", "-c", script],
                            cwd=ROOT / service, env=env, check=True, text=True,
                            stdout=subprocess.PIPE)
    return json.dumps(json.loads(result.stdout), ensure_ascii=False, sort_keys=True, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service", choices=("backend", "ai-service"), required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    target = ROOT / "docs/contracts/generated" / f"{args.service}.openapi.json"
    content = export(args.service)
    previous = target.read_text() if target.exists() else ""
    if args.check:
        if previous != content:
            print("".join(difflib.unified_diff(previous.splitlines(True), content.splitlines(True),
                                             fromfile=str(target), tofile="runtime OpenAPI")))
            print("Contract drift: run make contracts and review the change.", file=sys.stderr)
            return 1
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    print(f"Contract {'checked' if args.check else 'generated'}: {target.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
