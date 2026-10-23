"""Application commands use normalized inputs and never execute a graph."""

from ai_service.agent_core.contracts import ResultPending, request_hash
from ai_service.agent_core.ports import RunStore


class RunService:
    def __init__(self, store: RunStore, scope: str, execution: dict):
        self.store = store
        self.scope = scope
        self.execution = execution

    def create(self, key: str, workflow: str, payload: dict) -> dict:
        return self.store.create(
            self.scope,
            key,
            request_hash(workflow, payload),
            workflow,
            payload,
            self.execution if workflow == "wardrobe.recommend.v1" else None,
        )

    def cancel_by_key(self, key: str, workflow: str, payload: dict) -> dict:
        return self.store.cancel_by_key(
            self.scope,
            key,
            request_hash(workflow, payload),
            workflow,
            payload,
            self.execution if workflow == "wardrobe.recommend.v1" else None,
        )

    def get(self, run_id: str) -> dict:
        return self.store.get(self.scope, run_id)

    def result(self, run_id: str) -> dict:
        run = self.get(run_id)
        if run["status"] != "completed":
            raise ResultPending()
        return run["output"]

    def events(self, run_id: str, after: int) -> list[dict]:
        return self.store.events(self.scope, run_id, after)

    def cancel(self, run_id: str) -> dict:
        return self.store.cancel(self.scope, run_id)
