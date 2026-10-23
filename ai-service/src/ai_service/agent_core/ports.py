"""Persistence operations needed by application commands, independent of providers."""

from typing import Protocol

from ai_service.agent_core.model import ModelReply


class RunStore(Protocol):
    def create(
        self,
        scope: str,
        key: str,
        digest: str,
        workflow: str,
        payload: dict,
        execution: dict | None = None,
    ) -> dict: ...
    def cancel_by_key(
        self,
        scope: str,
        key: str,
        digest: str,
        workflow: str,
        payload: dict,
        execution: dict | None = None,
    ) -> dict: ...
    def get(self, scope: str, run_id: str) -> dict: ...
    def events(self, scope: str, run_id: str, after: int) -> list[dict]: ...
    def cancel(self, scope: str, run_id: str) -> dict: ...


class OperationStore(Protocol):
    def assert_authority(self) -> None: ...
    def lookup(self, run_id: str) -> dict | None: ...
    def begin(self, run_id: str, prepared: dict) -> dict: ...
    def respond(self, operation_id: str, reply: ModelReply) -> dict: ...
    def unknown(self, operation_id: str) -> None: ...
    def load(self, operation_id: str) -> dict: ...
