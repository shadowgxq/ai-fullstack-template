#!/usr/bin/env python3
"""Delegate all state transitions to the pinned canonical Manager runtime."""
from pathlib import Path
import runpy
import sys

RUNTIME = Path(__file__).resolve().parents[2] / ".agents/skills/manager-execute-current-batch/scripts"
sys.path.insert(0, str(RUNTIME))
if __name__ == "__main__":
    runpy.run_path(str(RUNTIME / "plan_tool.py"), run_name="__main__")
