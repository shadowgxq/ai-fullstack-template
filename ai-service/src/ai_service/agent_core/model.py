"""Provider-independent call boundary; credentials never enter requests or checkpoints."""

from dataclasses import dataclass
from typing import Protocol


class ExecutionFailure(Exception):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


class ModelCallUncertain(ExecutionFailure):
    """The request may have reached the provider without a complete response."""


@dataclass(frozen=True)
class ModelCall:
    adapter: str
    endpoint: str
    model: str
    payload: bytes
    timeout_seconds: float
    max_response_bytes: int
    response_transport: str = "responses-json.v1"


@dataclass(frozen=True)
class ModelReply:
    raw_response: bytes
    output: object
    returned_model: str | None
    request_id: str | None
    usage: dict[str, int | None] | None
    error_code: str | None = None


class ModelPort(Protocol):
    def validate_configuration(self, call: ModelCall) -> None:
        """No I/O; raise ExecutionFailure(model_not_configured/invalid_configuration)."""
        ...

    def invoke(self, call: ModelCall) -> ModelReply:
        """Exactly one bounded HTTP attempt; no redirects/retries/repair.

        Return the complete bounded raw response, even for rejection, invalid JSON,
        incomplete output or HTTP errors. Such replies use a safe error_code.
        Transport/timeout/oversize failures raise ModelCallUncertain. Missing usage
        stays None; known counts are nonnegative integers, never guessed prices.
        """
        ...
