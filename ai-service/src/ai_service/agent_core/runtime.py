"""Dispatch trusted, versioned workflows without importing an execution framework."""

from collections.abc import Callable, Mapping
from types import MappingProxyType

WorkflowExecutor = Callable[[str, Mapping[str, object]], Mapping[str, object]]


class UnsupportedWorkflow(ValueError):
    """The frozen workflow ID is not registered in this deployment."""


class WorkflowRunner:
    """Own only dispatch; each registered executor owns its workflow and recovery."""

    def __init__(self, workflows: Mapping[str, WorkflowExecutor]) -> None:
        if not workflows or any(
            not name.strip() or not callable(executor)
            for name, executor in workflows.items()
        ):
            raise ValueError("A non-empty registry of named executors is required")
        self._workflows = MappingProxyType(dict(workflows))

    @property
    def workflow_ids(self) -> tuple[str, ...]:
        return tuple(sorted(self._workflows))

    def run(
        self, workflow_id: str, run_id: str, payload: Mapping[str, object]
    ) -> dict[str, object]:
        if not run_id.strip():
            raise ValueError("A stable Run ID is required")
        try:
            execute = self._workflows[workflow_id]
        except KeyError:
            raise UnsupportedWorkflow(
                "Frozen workflow version is not registered"
            ) from None
        # Isolate the mapping itself; nested values remain the workflow's responsibility.
        return dict(execute(run_id, MappingProxyType(dict(payload))))
