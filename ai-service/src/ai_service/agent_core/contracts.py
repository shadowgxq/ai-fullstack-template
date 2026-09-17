"""Provider-independent runtime identities and errors."""

import hashlib
import json


class RunNotFound(Exception):
    pass


class IdempotencyConflict(Exception):
    pass


class ResultPending(Exception):
    pass


class WorkerAlreadyRunning(Exception):
    pass


def request_hash(workflow: str, payload: dict[str, str]) -> str:
    canonical = json.dumps(
        {"workflow": workflow, "input": payload},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
