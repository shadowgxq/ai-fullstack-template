"""Bounded native AI Run consumer; Outbox owns retries and business publication."""

import http.client
import io
import json
import math
import re
import socket
import time
from datetime import datetime
from functools import partial
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    StringConstraints,
)

Run = dict[str, JsonValue]
FrozenInput = dict[str, JsonValue]
_WORKFLOW = "wardrobe.recommend.v1"
_VERSIONS = {
    "catalog_version": "1",
    "policy_version": "wardrobe.filter.v1",
    "prompt_version": "wardrobe.recommend.prompt.v1",
    "schema_version": "wardrobe.recommend.output.v1",
}
_ID_PATTERN = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
_Id = Annotated[str, StringConstraints(pattern=_ID_PATTERN)]
_Ref = Annotated[
    str, StringConstraints(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_.:-]+$")
]
_TIMESTAMP_PATHS = {
    ("weather", "facts", "fetched_at"),
    ("weather", "facts", "valid_until"),
    ("weather", "facts", "observation", "observed_at"),
    ("weather", "facts", "forecast", "issued_at"),
}
_TEMPERATURE_PATHS = {
    ("weather", "facts", "observation", "temperature_c"),
    ("weather", "facts", "forecast", "high_c"),
    ("weather", "facts", "forecast", "low_c"),
}


class AiRuntimeError(Exception):
    def __init__(self, code: str, retryable: bool = False) -> None:
        self.code = code
        self.retryable = retryable
        super().__init__(code)


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class _Usage(_Strict):
    input_tokens: int | None = Field(ge=0)
    output_tokens: int | None = Field(ge=0)
    total_tokens: int | None = Field(ge=0)


class _Evidence(_Strict):
    operation_id: _Id
    response_ref: _Id
    adapter: Literal["openai.responses.v1"]
    requested_model: str = Field(min_length=1, max_length=128)
    returned_model: str | None = Field(min_length=1, max_length=128)
    request_id: str | None = Field(min_length=1, max_length=200)
    usage: _Usage | None
    prompt_version: Literal["wardrobe.recommend.prompt.v1"]
    schema_version: Literal["wardrobe.recommend.output.v1"]


class _Output(_Strict):
    selected_ids: list[_Id] = Field(min_length=1, max_length=64)
    reason_codes: list[
        Literal[
            "known_attributes",
            "liked_style",
            "liked_color",
            "liked_occasion",
            "scene_reference",
            "weather_reference",
            "history_reference",
        ]
    ] = Field(max_length=32)
    fact_refs: list[_Ref] = Field(max_length=128)
    tradeoff_codes: list[
        Literal[
            "partial_outfit",
            "unknown_attributes",
            "weather_missing",
            "history_empty",
            "comfort_reference_only",
            "candidate_scope_limited",
        ]
    ] = Field(max_length=32)
    call_evidence: _Evidence


class _Run(_Strict):
    run_id: _Id
    workflow: str
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    input: dict[str, JsonValue]
    output: _Output | None
    error_code: (
        Annotated[
            str,
            StringConstraints(
                min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_]*$"
            ),
        ]
        | None
    )
    last_sequence: int = Field(ge=1)
    created_at: AwareDatetime = Field(strict=False)
    cancel_requested: bool


def _remaining(deadline: float) -> float:
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError()
    return remaining


class _DeadlineReader(io.RawIOBase):
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


class _ConnectionMixin:
    def __init__(
        self, host: str, port: int | None, timeout: float, deadline: float
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


class _HTTPConnection(_ConnectionMixin, http.client.HTTPConnection):
    pass


class _HTTPSConnection(_ConnectionMixin, http.client.HTTPSConnection):
    pass


def _object(pairs: list[tuple[str, JsonValue]]) -> dict[str, JsonValue]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate_json_key")
        result[key] = value
    return result


def _constant(value: str) -> None:
    raise ValueError("non_finite_json")


def _float(value: str) -> float:
    parsed = float(value)
    if not math.isfinite(parsed):
        raise ValueError("non_finite_json")
    return parsed


def _persistable(value: JsonValue) -> None:
    if isinstance(value, str):
        if "\x00" in value:
            raise ValueError("invalid_unicode")
        value.encode("utf-8")
    elif isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise ValueError("non_json_key")
            _persistable(key)
            _persistable(item)
    elif isinstance(value, list):
        for item in value:
            _persistable(item)
    elif type(value) is float and not math.isfinite(value):
        raise ValueError("non_finite_json")
    elif value is not None and type(value) not in (int, float, bool):
        raise ValueError("non_json_value")


def _json(raw: bytes) -> JsonValue:
    value = json.loads(
        raw.decode("utf-8"),
        object_pairs_hook=_object,
        parse_constant=_constant,
        parse_float=_float,
    )
    _persistable(value)
    return value


def _timestamp(value: JsonValue) -> datetime:
    if not isinstance(value, str):
        raise ValueError("timestamp_required")
    result = datetime.fromisoformat(value)
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError("timezone_required")
    return result


def _same_input(
    actual: JsonValue, expected: JsonValue, path: tuple[str, ...] = ()
) -> bool:
    # Pydantic normalizes ISO timestamps and weather floats on the provider side.
    if path in _TIMESTAMP_PATHS:
        return _timestamp(actual) == _timestamp(expected)
    if (
        path in _TEMPERATURE_PATHS
        and type(actual) in (int, float)
        and type(expected) in (int, float)
    ):
        return actual == expected
    if type(actual) is not type(expected):
        return False
    if isinstance(expected, dict):
        return actual.keys() == expected.keys() and all(
            _same_input(actual[key], value, (*path, key))
            for key, value in expected.items()
        )
    if isinstance(expected, list):
        return len(actual) == len(expected) and all(
            _same_input(a, e, (*path, str(index)))
            for index, (a, e) in enumerate(zip(actual, expected))
        )
    return actual == expected


def _validate_run(value: JsonValue, payload: FrozenInput, run_id: str | None) -> Run:
    parsed = _Run.model_validate(value)
    if (
        parsed.workflow != _WORKFLOW
        or (run_id is not None and parsed.run_id != run_id)
        or not _same_input(value["input"], payload)
    ):
        raise AiRuntimeError("ai_identity_mismatch")
    if not isinstance(value["created_at"], str):
        raise ValueError("timestamp_required")
    if parsed.status == "completed":
        if parsed.output is None or parsed.error_code is not None:
            raise ValueError("inconsistent_completed")
        output = parsed.output
        for items in (
            output.selected_ids,
            output.reason_codes,
            output.fact_refs,
            output.tradeoff_codes,
        ):
            if len(items) != len(set(items)):
                raise ValueError("duplicate_output")
        candidates = {candidate["id"] for candidate in payload["candidates"]}
        refs = {atom["ref_id"]: atom for atom in payload["fact_refs"]}
        selected = set(output.selected_ids)
        if not selected <= candidates or any(
            ref not in refs
            or (
                refs[ref]["subject_id"] is not None
                and refs[ref]["subject_id"] not in selected
            )
            for ref in output.fact_refs
        ):
            raise ValueError("unknown_output_member")
    elif parsed.output is not None or (
        (parsed.error_code is not None) != (parsed.status == "failed")
    ):
        raise ValueError("inconsistent_status")
    if parsed.status == "cancelled" and not parsed.cancel_requested:
        raise ValueError("unconfirmed_cancellation")
    return value


class AiRuntimeClient:
    """Construction is offline; each operation sends once and validates its Run."""

    def __init__(
        self,
        base_url: str | None,
        api_key: str | None,
        timeout_seconds: float = 5,
        max_response_bytes: int = 1048576,
    ) -> None:
        self._base_url = base_url
        self._api_key = api_key
        self._timeout_seconds = timeout_seconds
        self._max_response_bytes = max_response_bytes

    def _configuration(self) -> tuple[str, str, int | None]:
        try:
            if (
                not isinstance(self._base_url, str)
                or not self._base_url
                or not isinstance(self._api_key, str)
                or not 1 <= len(self._api_key) <= 4096
                or any(not 32 < ord(char) < 127 for char in self._api_key)
            ):
                raise ValueError()
            if any(ord(char) <= 32 or ord(char) >= 127 for char in self._base_url):
                raise ValueError()
            target = urlsplit(self._base_url)
            host, port = target.hostname, target.port
            if (
                target.scheme not in ("http", "https")
                or not host
                or target.username is not None
                or target.password is not None
                or target.path not in ("", "/")
                or target.query
                or target.fragment
            ):
                raise ValueError()
            if not re.fullmatch(r"[a-zA-Z0-9.:-]+", host) or (
                port is not None and port < 1
            ):
                raise ValueError()
            if (
                type(self._timeout_seconds) not in (int, float)
                or not math.isfinite(self._timeout_seconds)
                or self._timeout_seconds <= 0
                or type(self._max_response_bytes) is not int
                or self._max_response_bytes <= 0
            ):
                raise ValueError()
        except (ValueError, TypeError):
            raise AiRuntimeError("ai_not_configured") from None
        return target.scheme, host, port

    def create_run(self, key: str, payload: FrozenInput) -> Run:
        return self._key_request("/api/v1/runs", key, payload, 202)

    def cancel_by_key(self, key: str, payload: FrozenInput) -> Run:
        """Cancel an unknown remote Run without creating a runnable command."""
        return self._key_request("/api/v1/runs/cancel-by-key", key, payload, 200)

    def _key_request(
        self, path: str, key: str, payload: FrozenInput, status: int
    ) -> Run:
        if not isinstance(key, str) or re.fullmatch(r"[!-~]{1,128}", key) is None:
            raise AiRuntimeError("ai_invalid_response")
        return self._request("POST", path, payload, key=key, expected_status=status)

    def get_run(self, run_id: str, payload: FrozenInput) -> Run:
        return self._request("GET", self._path(run_id), payload, run_id=run_id)

    def cancel_run(self, run_id: str, payload: FrozenInput) -> Run:
        return self._request(
            "POST", self._path(run_id) + "/cancel", payload, run_id=run_id
        )

    @staticmethod
    def _path(run_id: str) -> str:
        if not isinstance(run_id, str) or re.fullmatch(_ID_PATTERN, run_id) is None:
            raise AiRuntimeError("ai_identity_mismatch")
        return "/api/v1/runs/" + run_id

    def _request(
        self,
        method: str,
        path: str,
        payload: FrozenInput,
        *,
        key: str | None = None,
        run_id: str | None = None,
        expected_status: int = 200,
    ) -> Run:
        scheme, host, port = self._configuration()
        try:
            _persistable(payload)
            if not isinstance(payload, dict) or payload.get("versions") != _VERSIONS:
                raise ValueError()
            encoded_input = json.dumps(
                payload, ensure_ascii=False, allow_nan=False
            ).encode()
            if len(encoded_input) > 512 * 1024:
                raise ValueError()
            # Retain the exact sent snapshot even if a caller later mutates its dict.
            frozen = json.loads(encoded_input)
            body = (
                json.dumps(
                    {"workflow": _WORKFLOW, "input": frozen},
                    ensure_ascii=False,
                    allow_nan=False,
                ).encode()
                if key is not None
                else None
            )
        except (ValueError, TypeError, RecursionError):
            raise AiRuntimeError("ai_invalid_response") from None
        deadline = time.monotonic() + self._timeout_seconds
        connection_type = _HTTPSConnection if scheme == "https" else _HTTPConnection
        connection = None
        response = None
        try:
            connection = connection_type(host, port, self._timeout_seconds, deadline)
            headers = {
                "Authorization": "Bearer " + self._api_key,
                "Accept": "application/json",
                "Accept-Encoding": "identity",
                "Connection": "close",
            }
            if key is not None:
                headers.update(
                    {"Idempotency-Key": key, "Content-Type": "application/json"}
                )
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            _remaining(deadline)
            if (
                response.length is not None
                and response.length > self._max_response_bytes
            ):
                raise AiRuntimeError("ai_invalid_response")
            raw = bytearray()
            while True:
                _remaining(deadline)
                chunk = response.read1(
                    min(65536, self._max_response_bytes - len(raw) + 1)
                )
                if not chunk:
                    if response.length not in (None, 0):
                        raise AiRuntimeError("ai_unavailable", retryable=True)
                    break
                raw.extend(chunk)
                if len(raw) > self._max_response_bytes:
                    raise AiRuntimeError("ai_invalid_response")
            if response.status in (401, 403):
                raise AiRuntimeError("ai_not_configured")
            if response.status in (404, 409):
                raise AiRuntimeError("ai_identity_mismatch")
            if response.status in (408, 425, 429) or 500 <= response.status <= 599:
                raise AiRuntimeError("ai_unavailable", retryable=True)
            if response.status != expected_status:
                raise AiRuntimeError("ai_invalid_response")
            try:
                return _validate_run(_json(bytes(raw)), frozen, run_id)
            except (ValueError, TypeError, KeyError, RecursionError):
                raise AiRuntimeError("ai_invalid_response") from None
        except (OSError, http.client.HTTPException):
            # Exceptions can carry tokens, URLs or response fragments; keep only safe codes.
            raise AiRuntimeError("ai_unavailable", retryable=True) from None
        finally:
            try:
                if response is not None:
                    response.close()
            finally:
                if connection is not None:
                    connection.close()
