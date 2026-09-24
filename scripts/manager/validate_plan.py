#!/usr/bin/env python3
"""Read-only project entry to the SAME schema/runtime used for execution.

Planned artifacts may not exist. start/gate validate sources, approvals and evidence.
Do not implement another lifecycle here or turn structural checks into approval.
"""
from pathlib import Path
import sys

RUNTIME = Path(__file__).resolve().parents[2] / ".agents/skills/manager-execute-current-batch/scripts"
sys.path.insert(0, str(RUNTIME))
from manager_schema import Invalid, parse, validate  # noqa: E402
from manager_store import Store  # noqa: E402


def load_plan(path):
    return parse(Path(path).read_text(encoding="utf-8"))


def validate_plan(path: Path) -> list[str]:
    try:
        store = Store(path)
        store.load()
        errors, _ = validate(store.plan, strict_inputs=True, completed_ids=store.valid_completions())
        # Reject escaping local references even before files are created. Actual existence
        # belongs to start, so a future change need not contain invented artifacts.
        for requirement in store.plan["requirements"]:
            source = requirement["source"]
            if not source.startswith(("https://", "http://")):
                store.file(source)
        for entry in store.plan["openspec"]:
            if entry["phase"] == "done" and not store.proof(entry["id"]):
                errors.append(entry["id"] + ": missing valid completion proof")
        return errors
    except (Invalid, ValueError, OSError, TypeError) as exc:
        return [str(exc)]


if __name__ == "__main__":
    errors = validate_plan(Path(sys.argv[1] if len(sys.argv) > 1 else "manager/plan.yaml"))
    print("\n".join(errors) if errors else "Manager v2 plan OK")
    raise SystemExit(bool(errors))
