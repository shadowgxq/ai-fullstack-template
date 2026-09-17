"""Application commands use normalized inputs and never execute a graph."""

from ai_service.agent_core.contracts import ResultPending, request_hash
from ai_service.infrastructure.store import Store


class RunService:
    def __init__(self, store: Store, scope: str):
        self.store = store
        self.scope = scope

    def create(self, key: str, workflow: str, payload: dict[str, str]) -> dict:
        return self.store.create(
            self.scope, key, request_hash(workflow, payload), workflow, payload
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
