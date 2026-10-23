"""One Responses HTTP attempt; the caller owns durable operation/recovery state."""

import http.client
import io
import json
import math
import socket
import time
from functools import partial
from urllib.parse import urlsplit

from ai_service.agent_core.model import (
    ExecutionFailure,
    ModelCall,
    ModelCallUncertain,
    ModelReply,
)
from ai_service.config import model_base_url

_ENDPOINT = "https://api.openai.com/v1/responses"
_USAGE_FIELDS = ("input_tokens", "output_tokens", "total_tokens")


def _remaining(deadline: float) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError()
    return remaining


class _DeadlineReader(io.RawIOBase):
    """Apply the remaining budget per recv, including header/chunk-line reads."""

    def __init__(self, sock: socket.socket, deadline: float) -> None:
        self._socket = sock
        self._deadline = deadline
        self._source = None
        self._source = sock.makefile("rb", buffering=0)

    def readable(self) -> bool:
        return True

    def readinto(self, buffer: bytearray) -> int | None:
        self._socket.settimeout(_remaining(self._deadline))
        return self._source.readinto(buffer)

    def close(self) -> None:
        try:
            if self._source is not None:
                self._source.close()
        finally:
            super().close()


class _DeadlineResponse(http.client.HTTPResponse):
    def __init__(
        self,
        sock: socket.socket,
        debuglevel: int = 0,
        *,
        deadline: float,
        method: str | None = None,
    ) -> None:
        super().__init__(sock, debuglevel=debuglevel, method=method)
        self.fp.close()
        self.fp = io.BufferedReader(_DeadlineReader(sock, deadline))


class _DeadlineHTTPSConnection(http.client.HTTPSConnection):
    def __init__(
        self,
        timeout: float,
        deadline: float,
        host: str = "api.openai.com",
        port: int | None = None,
    ) -> None:
        super().__init__(host, port=port, timeout=timeout)
        self._deadline = deadline
        self.response_class = partial(_DeadlineResponse, deadline=deadline)

    def connect(self) -> None:
        self.timeout = _remaining(self._deadline)
        super().connect()
        self.sock.settimeout(_remaining(self._deadline))

    def send(self, data: bytes) -> None:
        if self.sock is None:
            self.connect()
        self.sock.settimeout(_remaining(self._deadline))
        super().send(data)


class _DeadlineHTTPConnection(http.client.HTTPConnection):
    def __init__(
        self, timeout: float, deadline: float, host: str, port: int | None = None
    ) -> None:
        super().__init__(host, port=port, timeout=timeout)
        self._deadline = deadline
        self.response_class = partial(_DeadlineResponse, deadline=deadline)

    def connect(self) -> None:
        self.timeout = _remaining(self._deadline)
        super().connect()
        self.sock.settimeout(_remaining(self._deadline))

    def send(self, data: bytes) -> None:
        if self.sock is None:
            self.connect()
        self.sock.settimeout(_remaining(self._deadline))
        super().send(data)


def _object(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_json_key")
        result[key] = value
    return result


def _constant(value: str) -> object:
    raise ValueError("non_finite_json")


def _float(value: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed):
        raise ValueError("non_finite_json")
    return parsed


def _json_safe(value: object) -> None:
    # PostgreSQL JSONB cannot store NUL or lone surrogates, even if json.loads accepts them.
    if isinstance(value, str):
        if "\x00" in value:
            raise ValueError("invalid_json_string")
        value.encode("utf-8")
    elif isinstance(value, dict):
        for key, item in value.items():
            _json_safe(key)
            _json_safe(item)
    elif isinstance(value, list):
        for item in value:
            _json_safe(item)


def _json(value: str) -> object:
    parsed = json.loads(
        value, object_pairs_hook=_object, parse_constant=_constant, parse_float=_float
    )
    _json_safe(parsed)
    return parsed


def _metadata(value: object, maximum: int) -> str | None:
    if (
        isinstance(value, str)
        and 0 < len(value) <= maximum
        and all(32 < ord(char) < 127 for char in value)
    ):
        return value
    return None


def _usage(value: object) -> dict[str, int | None] | None:
    if not isinstance(value, dict):
        return None
    return {
        key: count if type(count := value.get(key)) is int and count >= 0 else None
        for key in _USAGE_FIELDS
    }


def _output(body: dict[str, object]) -> dict[str, object] | None:
    if (
        body.get("status") != "completed"
        or body.get("error") is not None
        or body.get("incomplete_details") is not None
    ):
        return None
    items = body.get("output")
    if not isinstance(items, list) or not all(isinstance(item, dict) for item in items):
        return None
    # Reasoning items are metadata, not additional user-visible output or tool calls.
    if any(item.get("type") not in ("message", "reasoning") for item in items):
        return None
    messages = [item for item in items if item.get("type") == "message"]
    if len(messages) != 1:
        return None
    message = messages[0]
    if message.get("role") != "assistant" or message.get("status") != "completed":
        return None
    content = message.get("content")
    if not isinstance(content, list) or len(content) != 1:
        return None
    part = content[0]
    if (
        not isinstance(part, dict)
        or part.get("type") != "output_text"
        or not isinstance(part.get("text"), str)
    ):
        return None
    result = _json(part["text"])
    return result if isinstance(result, dict) else None


def _reply(raw: bytes, status: int, request_id: str | None) -> ModelReply:
    body = None
    output = None
    error_code = "provider_error" if not 200 <= status < 300 else "invalid_output"
    try:
        body = _json(raw.decode("utf-8"))
        if isinstance(body, dict) and 200 <= status < 300:
            output = _output(body)
            if output is not None:
                error_code = None
    except (ValueError, UnicodeError, RecursionError):
        # A complete malformed response remains evidence, not an uncertain send.
        pass
    return ModelReply(
        raw_response=raw,
        output=output,
        returned_model=_metadata(body.get("model"), 128)
        if isinstance(body, dict)
        else None,
        request_id=_metadata(request_id, 200),
        usage=_usage(body.get("usage")) if isinstance(body, dict) else None,
        error_code=error_code,
    )


class _SSECapture:
    """Accept a complete terminal event, never promote text deltas to a result."""

    def __init__(self) -> None:
        self.buffer = bytearray()
        self.data: list[bytes] = []
        self.event: str | None = None
        self.response: dict | None = None
        self.invalid = False
        self.terminal = False
        self.events = 0
        self.sequence = -1
        self.response_id: str | None = None

    def feed(self, chunk: bytes) -> None:
        self.buffer.extend(chunk)
        while b"\n" in self.buffer:
            line, _, rest = self.buffer.partition(b"\n")
            self.buffer = bytearray(rest)
            line = line.removesuffix(b"\r")
            try:
                if not line:
                    self._dispatch()
                    self.data, self.event = [], None
                elif line.startswith(b"data:"):
                    self.data.append(bytes(line[5:]).removeprefix(b" "))
                elif line.startswith(b"event:"):
                    if self.event is not None:
                        raise ValueError()
                    self.event = bytes(line[6:]).removeprefix(b" ").decode("utf-8")
                elif line.startswith(b":") or line.startswith((b"id:", b"retry:")):
                    continue
                elif b":" not in line:
                    raise ValueError()
            except (ValueError, UnicodeError, RecursionError, TypeError):
                self.invalid = True

    def _dispatch(self) -> None:
        if not self.data:
            return
        data = b"\n".join(self.data)
        if data == b"[DONE]":
            if not self.terminal:
                raise ValueError()
            return
        self.events += 1
        if self.events > 16384 or self.terminal:
            raise ValueError()
        value = _json(data.decode("utf-8"))
        if not isinstance(value, dict) or not isinstance(value.get("type"), str):
            raise ValueError()
        kind = value["type"]
        if self.event is not None and self.event != kind:
            raise ValueError()
        if "sequence_number" in value:
            sequence = value["sequence_number"]
            if type(sequence) is not int or sequence <= self.sequence:
                raise ValueError()
            self.sequence = sequence
        body = value.get("response")
        if isinstance(body, dict) and isinstance(body.get("id"), str):
            if self.response_id is not None and self.response_id != body["id"]:
                raise ValueError()
            self.response_id = body["id"]
        if kind in {"response.completed", "response.failed", "response.incomplete"}:
            if not isinstance(body, dict) or body.get("status") != kind.removeprefix(
                "response."
            ):
                raise ValueError()
            self.response, self.terminal = body, True
        elif kind == "error":
            self.response, self.terminal = {"status": "failed"}, True

    def reply(self, raw: bytes, status: int, request_id: str | None) -> ModelReply:
        if self.invalid:
            return ModelReply(
                raw, None, None, _metadata(request_id, 200), None, "invalid_output"
            )
        if not self.terminal:
            raise ModelCallUncertain("call_outcome_unknown")
        reply = _reply(canonical_response(self.response), status, request_id)
        return ModelReply(
            raw,
            reply.output,
            reply.returned_model,
            reply.request_id,
            reply.usage,
            reply.error_code,
        )


def canonical_response(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, allow_nan=False, separators=(",", ":")
    ).encode()


class OpenAIResponsesAdapter:
    def __init__(
        self,
        enabled: bool = False,
        api_key: str | None = None,
        *,
        endpoint: str = _ENDPOINT,
    ) -> None:
        self._enabled = enabled
        self._api_key = api_key
        self._endpoint = endpoint

    def validate_configuration(self, call: ModelCall) -> None:
        """Only inspect injected/frozen values; no environment, DNS or HTTP."""
        if (
            self._enabled is not True
            or not isinstance(self._api_key, str)
            or not self._api_key.strip()
        ):
            raise ExecutionFailure("model_not_configured")
        if (
            any(not 32 < ord(char) < 127 for char in self._api_key)
            or call.adapter != "openai.responses.v1"
            or not isinstance(call.endpoint, str)
            or call.endpoint != self._endpoint
            or call.response_transport not in ("responses-json.v1", "responses-sse.v1")
            or not isinstance(call.model, str)
            or _metadata(call.model, 128) != call.model
            or type(call.timeout_seconds) not in (int, float)
            or not math.isfinite(call.timeout_seconds)
            or call.timeout_seconds <= 0
            or type(call.max_response_bytes) is not int
            or call.max_response_bytes <= 0
            or not isinstance(call.payload, bytes)
            or not call.payload
        ):
            raise ExecutionFailure("invalid_configuration")
        try:
            if (
                model_base_url(call.endpoint.removesuffix("/responses")) + "/responses"
                != call.endpoint
            ):
                raise ValueError()
            payload = _json(call.payload.decode("utf-8"))
            if (
                not isinstance(payload, dict)
                or payload.get("model") != call.model
                or payload.get("stream", False)
                is not (call.response_transport == "responses-sse.v1")
                or payload.get("background", False) is not False
            ):
                raise ValueError()
        except (ValueError, UnicodeError, RecursionError):
            raise ExecutionFailure("invalid_configuration") from None

    def invoke(self, call: ModelCall) -> ModelReply:
        self.validate_configuration(call)
        deadline = time.monotonic() + call.timeout_seconds
        target = urlsplit(call.endpoint)
        connection_type = (
            _DeadlineHTTPSConnection
            if target.scheme == "https"
            else _DeadlineHTTPConnection
        )
        connection = connection_type(
            call.timeout_seconds, deadline, target.hostname, target.port
        )
        stream = (
            _SSECapture() if call.response_transport == "responses-sse.v1" else None
        )
        response = None
        try:
            # http.client issues this request once; it neither follows redirects nor retries.
            connection.request(
                "POST",
                target.path,
                body=call.payload,
                headers={
                    "Authorization": "Bearer " + self._api_key,
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream" if stream else "application/json",
                    "Accept-Encoding": "identity",
                    "Connection": "close",
                },
            )
            response = connection.getresponse()
            _remaining(deadline)
            if (
                response.length is not None
                and response.length > call.max_response_bytes
            ):
                raise ModelCallUncertain("call_outcome_unknown")
            raw = bytearray()
            while True:
                _remaining(deadline)
                chunk = response.read1(
                    min(65536, call.max_response_bytes - len(raw) + 1)
                )
                if not chunk:
                    if response.length not in (None, 0):
                        raise ModelCallUncertain("call_outcome_unknown")
                    break
                raw.extend(chunk)
                if len(raw) > call.max_response_bytes:
                    raise ModelCallUncertain("call_outcome_unknown")
                if stream is not None and 200 <= response.status < 300:
                    stream.feed(chunk)
                    if stream.terminal and not stream.invalid:
                        break
            if stream is not None and 200 <= response.status < 300:
                return stream.reply(
                    bytes(raw), response.status, response.getheader("x-request-id")
                )
            return _reply(
                bytes(raw), response.status, response.getheader("x-request-id")
            )
        except (OSError, http.client.HTTPException) as error:
            raise ModelCallUncertain("call_outcome_unknown") from error
        finally:
            try:
                if response is not None:
                    response.close()
            finally:
                connection.close()
