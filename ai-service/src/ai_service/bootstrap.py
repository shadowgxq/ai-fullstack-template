"""Static workflow registration; callers inject a process-owned execution backend."""

from collections.abc import Callable, Mapping

from ai_service.agent_core.runtime import WorkflowRunner

EchoExecutor = Callable[[str, str], dict[str, str]]


def create_runner(execute_echo: EchoExecutor) -> WorkflowRunner:
    """Bind the deterministic workflow without creating connections or reading secrets."""

    def echo(run_id: str, payload: Mapping[str, object]) -> dict[str, str]:
        text = payload.get("text")
        if (
            set(payload) != {"text"}
            or not isinstance(text, str)
            or not 1 <= len(text) <= 2000
        ):
            raise ValueError("Invalid persisted echo input")
        return execute_echo(run_id, text)

    return WorkflowRunner({"echo.v1": echo})
