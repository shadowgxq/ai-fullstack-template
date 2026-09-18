"""Persistence operations needed by application commands, independent of providers."""

from typing import Protocol


class RunStore(Protocol):
    def create(
        self, scope: str, key: str, digest: str, workflow: str, payload: dict
    ) -> dict: ...
    def get(self, scope: str, run_id: str) -> dict: ...
    def events(self, scope: str, run_id: str, after: int) -> list[dict]: ...
