import io
import json
from dataclasses import replace

import pytest

from ai_service.agent_core.model import ExecutionFailure, ModelCall, ModelCallUncertain
from ai_service.infrastructure import model_adapter
from ai_service.infrastructure.model_adapter import OpenAIResponsesAdapter


def call(**changes) -> ModelCall:
    payload = json.dumps(
        {
            "model": "configured-model",
            "input": "frozen input",
            "stream": False,
            "store": False,
        }
    ).encode()
    return replace(
        ModelCall(
            "openai.responses.v1",
            "https://api.openai.com/v1/responses",
            "configured-model",
            payload,
            3.0,
            4096,
        ),
        **changes,
    )


def completed(**changes) -> dict:
    body = {
        "id": "body-id-must-not-be-request-id",
        "status": "completed",
        "error": None,
        "incomplete_details": None,
        "model": "actual-returned-model",
        "output": [
            {
                "type": "message",
                "status": "completed",
                "role": "assistant",
                "content": [
                    {"type": "output_text", "text": '{"selected_ids":["one"]}'}
                ],
            }
        ],
        "usage": {"input_tokens": 5, "output_tokens": 7, "total_tokens": 12},
    }
    return body | changes


class WireReader(io.RawIOBase):
    def __init__(self, owner):
        self.owner = owner

    def readable(self):
        return True

    def readinto(self, buffer):
        if self.owner.read_error:
            raise self.owner.read_error
        self.owner.clock += self.owner.read_delay
        chunk = self.owner.source.read(min(len(buffer), self.owner.chunk_size))
        buffer[: len(chunk)] = chunk
        return len(chunk)


class WireSocket:
    def __init__(self, wire: bytes):
        self.source = io.BytesIO(wire)
        self.sent = []
        self.timeouts = []
        self.closed = False
        self.read_error = None
        self.read_delay = 0.0
        self.clock = 0.0
        self.chunk_size = 65536

    def makefile(self, mode, buffering=-1):
        assert mode == "rb"
        reader = WireReader(self)
        return reader if buffering == 0 else io.BufferedReader(reader)

    def sendall(self, data):
        self.sent.append(data)

    def settimeout(self, timeout):
        self.timeouts.append(timeout)

    def close(self):
        self.closed = True


@pytest.fixture
def http_boundary(monkeypatch):
    sockets = []
    targets = []

    def install(
        body: object = None,
        *,
        raw: bytes | None = None,
        status: int = 200,
        headers: bytes = b"X-Request-Id: request-from-header\r\n",
        length: int | None = None,
        chunked: bool = False,
    ):
        data = (
            raw
            if raw is not None
            else json.dumps(completed() if body is None else body).encode()
        )
        framing = (
            b"Transfer-Encoding: chunked\r\n"
            if chunked
            else b"Content-Length: "
            + str(len(data) if length is None else length).encode()
            + b"\r\n"
        )
        sock = WireSocket(
            b"HTTP/1.1 "
            + str(status).encode()
            + b" Test\r\n"
            + framing
            + headers
            + b"Connection: close\r\n\r\n"
            + data
        )
        sockets.append(sock)
        return sock

    def connect(connection):
        targets.append((connection.host, connection.port, connection.timeout))
        connection.sock = sockets[-1]

    monkeypatch.setattr(model_adapter._DeadlineHTTPSConnection, "connect", connect)
    monkeypatch.setattr(model_adapter._DeadlineHTTPConnection, "connect", connect)
    return install, targets


def test_complete_response_preserves_wire_and_known_evidence(http_boundary, caplog):
    install, targets = http_boundary
    raw = json.dumps(completed()).encode()
    sock = install(
        raw=raw,
        headers=b"X-Request-ID: provider-request\r\nSet-Cookie: do-not-export\r\n",
    )
    frozen = call()
    adapter = OpenAIResponsesAdapter(True, "dummy-test-key")
    adapter.validate_configuration(frozen)
    assert not targets
    reply = adapter.invoke(frozen)
    assert reply.raw_response == raw
    assert reply.output == {"selected_ids": ["one"]}
    assert reply.returned_model == "actual-returned-model"
    assert reply.request_id == "provider-request"
    assert reply.usage == {"input_tokens": 5, "output_tokens": 7, "total_tokens": 12}
    assert reply.error_code is None
    assert targets == [("api.openai.com", 443, 3.0)]
    wire = b"".join(sock.sent)
    assert wire.count(b"POST /v1/responses HTTP/1.1") == 1
    assert wire.endswith(frozen.payload)
    assert b"Authorization: Bearer dummy-test-key\r\n" in wire
    assert b"Accept-Encoding: identity\r\n" in wire
    assert sock.closed
    assert "dummy-test-key" not in caplog.text and raw.decode() not in caplog.text


@pytest.mark.parametrize(
    "adapter",
    [
        OpenAIResponsesAdapter(),
        OpenAIResponsesAdapter(False, "dummy"),
        OpenAIResponsesAdapter(True, None),
        OpenAIResponsesAdapter(True, "  "),
    ],
)
def test_disabled_or_missing_key_never_constructs_http(monkeypatch, adapter):
    def forbidden(*args, **kwargs):
        pytest.fail("configuration must not construct or send HTTP")

    monkeypatch.setattr(model_adapter, "_DeadlineHTTPSConnection", forbidden)
    for operation in (adapter.validate_configuration, adapter.invoke):
        with pytest.raises(ExecutionFailure, match="^model_not_configured$"):
            operation(call())


@pytest.mark.parametrize(
    "changes",
    [
        {"adapter": "other"},
        {"endpoint": "https://evil.example/v1/responses"},
        {"endpoint": "https://api.openai.com/v1/responses?extra=1"},
        {"model": ""},
        {"timeout_seconds": 0},
        {"timeout_seconds": float("nan")},
        {"timeout_seconds": True},
        {"max_response_bytes": 0},
        {"max_response_bytes": True},
        {"payload": b'{"model":"different"}'},
        {"payload": b'{"model":"configured-model","stream":true}'},
        {"payload": b'{"model":"configured-model","background":true}'},
        {"payload": b'{"model":"configured-model","model":"configured-model"}'},
    ],
)
def test_invalid_frozen_configuration_is_offline(monkeypatch, changes):
    def forbidden(*args, **kwargs):
        pytest.fail("invalid configuration must not reach HTTP")

    monkeypatch.setattr(model_adapter, "_DeadlineHTTPSConnection", forbidden)
    with pytest.raises(ExecutionFailure, match="^invalid_configuration$"):
        OpenAIResponsesAdapter(True, "dummy").invoke(call(**changes))


def test_header_injection_in_injected_key_is_offline(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("invalid header must not reach HTTP")

    monkeypatch.setattr(model_adapter, "_DeadlineHTTPSConnection", forbidden)
    with pytest.raises(ExecutionFailure, match="^invalid_configuration$"):
        OpenAIResponsesAdapter(True, "dummy\r\nInjected: value").invoke(call())


@pytest.mark.parametrize("status", [302, 401, 429, 500])
def test_complete_http_errors_are_evidence_with_no_redirect_or_retry(
    http_boundary, status
):
    install, targets = http_boundary
    raw = b'{"error":{"message":"private provider details"}}'
    sock = install(
        raw=raw,
        status=status,
        headers=b"Location: https://evil.example/steal\r\nX-Request-Id: error-id\r\n",
    )
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(call())
    assert reply.raw_response == raw and reply.error_code == "provider_error"
    assert reply.output is None and reply.request_id == "error-id"
    assert reply.returned_model is None and reply.usage is None
    assert len(targets) == 1 and b"evil.example" not in b"".join(sock.sent)
    assert sock.closed


@pytest.mark.parametrize(
    "variant",
    [
        "refusal",
        "incomplete",
        "failed",
        "two_texts",
        "two_messages",
        "tool_call",
        "non_object",
        "duplicate_key",
        "nan",
        "infinity",
        "overflow",
        "nul",
        "surrogate",
        "empty_text",
        "empty_content",
        "trailing",
        "unfinished_message",
    ],
)
def test_complete_invalid_outputs_never_repair_or_guess(http_boundary, variant):
    install, targets = http_boundary
    body = completed()
    message = body["output"][0]
    if variant == "refusal":
        message["content"] = [{"type": "refusal", "refusal": "cannot comply"}]
    elif variant in ("incomplete", "failed"):
        body["status"] = variant
    elif variant == "two_texts":
        message["content"] *= 2
    elif variant == "two_messages":
        body["output"] *= 2
    elif variant == "tool_call":
        body["output"].append({"type": "function_call", "arguments": "{}"})
    elif variant == "unfinished_message":
        message["status"] = "in_progress"
    elif variant == "empty_content":
        message["content"] = []
    else:
        message["content"][0]["text"] = {
            "non_object": "[]",
            "duplicate_key": '{"x":1,"x":2}',
            "nan": '{"x":NaN}',
            "infinity": '{"x":Infinity}',
            "overflow": '{"x":1e999}',
            "nul": '{"x":"\\u0000"}',
            "surrogate": '{"x":"\\ud800"}',
            "empty_text": "",
            "trailing": "{} {}",
        }[variant]
    raw = json.dumps(body).encode()
    install(raw=raw)
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(call())
    assert reply.raw_response == raw and reply.error_code == "invalid_output"
    assert reply.output is None and len(targets) == 1
    assert reply.usage == {"input_tokens": 5, "output_tokens": 7, "total_tokens": 12}


@pytest.mark.parametrize(
    "raw", [b"not-json", b"\xff", b"[]", b'{"status":"completed","status":"completed"}']
)
def test_complete_bad_response_body_stays_raw_not_uncertain(http_boundary, raw):
    install, targets = http_boundary
    install(raw=raw)
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(call())
    assert reply.raw_response == raw and reply.error_code == "invalid_output"
    assert reply.output is None and len(targets) == 1


def test_reasoning_is_not_an_extra_text_and_missing_metadata_stays_unknown(
    http_boundary,
):
    install, _ = http_boundary
    body = completed(
        model=None,
        usage={"input_tokens": True, "output_tokens": -1, "total_tokens": 1.5},
    )
    body["output"].insert(0, {"type": "reasoning", "summary": []})
    install(body, headers=b"")
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(call())
    assert reply.output == {"selected_ids": ["one"]} and reply.error_code is None
    assert reply.returned_model is None and reply.request_id is None
    assert reply.usage == {
        "input_tokens": None,
        "output_tokens": None,
        "total_tokens": None,
    }


def test_missing_usage_is_not_zero_or_a_fabricated_total(http_boundary):
    install, _ = http_boundary
    body = completed()
    del body["usage"]
    install(body, headers=b"")
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(call())
    assert reply.usage is None and reply.request_id is None
    install(completed(usage={"input_tokens": 0, "output_tokens": 3}))
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(call())
    assert reply.usage == {"input_tokens": 0, "output_tokens": 3, "total_tokens": None}
    install(completed(usage={"input_tokens": "5", "total_tokens": 0}))
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(call())
    assert reply.usage == {
        "input_tokens": None,
        "output_tokens": None,
        "total_tokens": 0,
    }


@pytest.mark.parametrize(
    "mode",
    [
        "declared_oversize",
        "streamed_oversize",
        "truncated",
        "timeout",
        "disconnect",
        "bad_chunk",
    ],
)
def test_no_complete_bounded_response_is_uncertain_and_never_retried(
    http_boundary, mode
):
    install, targets = http_boundary
    maximum = 64
    if mode == "declared_oversize":
        sock = install(raw=b"x", length=maximum + 1)
    elif mode == "streamed_oversize":
        sock = install(raw=b"41\r\n" + b"x" * 65 + b"\r\n0\r\n\r\n", chunked=True)
    elif mode == "truncated":
        sock = install(raw=b"short", length=50)
    elif mode == "bad_chunk":
        sock = install(raw=b"5\r\nabc", chunked=True)
    else:
        sock = install(raw=b"body")
        sock.read_error = (
            TimeoutError() if mode == "timeout" else ConnectionResetError()
        )
    with pytest.raises(ModelCallUncertain, match="^call_outcome_unknown$"):
        OpenAIResponsesAdapter(True, "dummy").invoke(call(max_response_bytes=maximum))
    assert len(targets) == 1 and sock.closed


def test_exact_body_limit_is_allowed_and_complete_chunk_framing_is_consumed(
    http_boundary,
):
    install, targets = http_boundary
    raw = json.dumps(completed()).encode()
    install(raw=raw)
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(
        call(max_response_bytes=len(raw))
    )
    assert reply.raw_response == raw and reply.error_code is None
    install(raw=f"{len(raw):x}\r\n".encode() + raw + b"\r\n0\r\n\r\n", chunked=True)
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(
        call(max_response_bytes=len(raw))
    )
    assert reply.raw_response == raw and reply.error_code is None and len(targets) == 2


def test_slow_header_drips_cannot_reset_the_whole_receive_budget(
    http_boundary, monkeypatch
):
    install, targets = http_boundary
    sock = install()
    sock.chunk_size = 1
    sock.read_delay = 0.4
    monkeypatch.setattr(model_adapter.time, "monotonic", lambda: sock.clock)
    with pytest.raises(ModelCallUncertain):
        OpenAIResponsesAdapter(True, "dummy").invoke(call(timeout_seconds=1.0))
    assert 0 < sock.clock <= 1.3 and len(targets) == 1
    assert sock.timeouts and all(0 < timeout <= 1.0 for timeout in sock.timeouts)
    assert sock.closed


def test_metadata_bounds_match_the_real_public_call_evidence(http_boundary):
    from ai_service.api.schemas import CallEvidence

    install, _ = http_boundary
    for model, request_id, expected_model, expected_id in [
        ("m" * 128, "r" * 200, "m" * 128, "r" * 200),
        ("m" * 129, "r" * 201, None, None),
    ]:
        raw = json.dumps(completed(model=model)).encode()
        install(raw=raw, headers=("X-Request-Id: " + request_id + "\r\n").encode())
        reply = OpenAIResponsesAdapter(True, "dummy").invoke(call())
        assert reply.raw_response == raw and reply.error_code is None
        assert (
            reply.returned_model == expected_model and reply.request_id == expected_id
        )
        evidence = CallEvidence.model_validate_json(
            json.dumps(
                {
                    "operation_id": "11111111-1111-4111-8111-111111111111",
                    "response_ref": "22222222-2222-4222-8222-222222222222",
                    "adapter": "openai.responses.v1",
                    "requested_model": "configured-model",
                    "returned_model": reply.returned_model,
                    "request_id": reply.request_id,
                    "usage": reply.usage,
                    "prompt_version": "wardrobe.recommend.prompt.v1",
                    "schema_version": "wardrobe.recommend.output.v1",
                }
            )
        )
        assert (
            evidence.returned_model == expected_model
            and evidence.request_id == expected_id
        )


def test_connection_failure_is_uncertain_and_not_retried(monkeypatch):
    attempts = []

    def fail_connect(connection):
        attempts.append(connection.host)
        raise OSError("offline transport failure")

    monkeypatch.setattr(model_adapter._DeadlineHTTPSConnection, "connect", fail_connect)
    with pytest.raises(ModelCallUncertain, match="^call_outcome_unknown$"):
        OpenAIResponsesAdapter(True, "dummy").invoke(call())
    assert attempts == ["api.openai.com"]


def sse_event(kind, response=None, **fields):
    event = {"type": kind, **fields}
    if response is not None:
        event["response"] = response
    return (
        "event: "
        + kind
        + "\r\ndata: "
        + json.dumps(event, ensure_ascii=False)
        + "\r\n\r\n"
    ).encode()


def sse_call(**changes):
    original = call(response_transport="responses-sse.v1", **changes)
    body = json.loads(original.payload)
    body["stream"] = True
    return replace(original, payload=json.dumps(body).encode())


def test_configured_http_gateway_uses_only_its_origin_and_path(http_boundary):
    install, targets = http_boundary
    sock = install()
    endpoint = "http://gateway.invalid:8081/v1/responses"
    reply = OpenAIResponsesAdapter(True, "dummy", endpoint=endpoint).invoke(
        call(endpoint=endpoint)
    )
    assert reply.error_code is None
    assert targets == [("gateway.invalid", 8081, 3.0)]
    assert b"POST /v1/responses HTTP/1.1" in b"".join(sock.sent)
    assert sock.closed


def test_current_key_cannot_be_sent_to_previous_frozen_origin(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("origin mismatch must fail before constructing transport")

    monkeypatch.setattr(model_adapter, "_DeadlineHTTPSConnection", forbidden)
    with pytest.raises(ExecutionFailure, match="^invalid_configuration$"):
        OpenAIResponsesAdapter(
            True, "new-origin-key", endpoint="https://gateway.invalid/v1/responses"
        ).invoke(call())


def test_sse_terminal_preserves_raw_usage_and_ignores_text_deltas(http_boundary):
    install, targets = http_boundary
    response = completed(id="resp-1")
    raw = (
        b": keepalive\r\n\r\n"
        + sse_event("response.created", {"id": "resp-1"}, sequence_number=0)
        + sse_event(
            "response.output_text.delta", delta="not a JSON result", sequence_number=1
        )
        + sse_event("response.completed", response, sequence_number=2)
    )
    sock = install(raw=raw)
    sock.chunk_size = 3
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(sse_call())
    assert reply.raw_response == raw
    assert reply.output == {"selected_ids": ["one"]}
    assert (
        reply.usage == response["usage"] and reply.returned_model == response["model"]
    )
    assert reply.request_id == "request-from-header" and reply.error_code is None
    assert len(targets) == 1 and sock.closed
    assert b"Accept: text/event-stream" in b"".join(sock.sent)


def test_sse_completion_does_not_wait_for_connection_eof(http_boundary):
    install, _ = http_boundary
    raw = sse_event("response.completed", completed())
    sock = install(raw=raw + b"server never closes this connection")
    sock.chunk_size = 1
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(sse_call())
    assert reply.raw_response == raw and reply.error_code is None and sock.closed


@pytest.mark.parametrize(
    "raw",
    [
        b"data: [DONE]\n\n",
        b"data: {bad-json}\n\n",
        sse_event("response.created", {"id": "one"}, sequence_number=2)
        + sse_event("response.completed", completed(id="two"), sequence_number=3),
        sse_event("response.created", {"id": "one"}, sequence_number=2)
        + sse_event("response.completed", completed(id="one"), sequence_number=2),
        b"event: response.failed\ndata: "
        + json.dumps({"type": "response.completed", "response": completed()}).encode()
        + b"\n\n",
        sse_event("response.completed", completed())
        + sse_event("response.completed", completed()),
        sse_event("response.completed", completed(status="in_progress")),
    ],
)
def test_sse_malformed_or_conflicting_events_never_publish(http_boundary, raw):
    install, targets = http_boundary
    install(raw=raw)
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(sse_call())
    assert reply.output is None and reply.error_code == "invalid_output"
    assert reply.raw_response == raw and len(targets) == 1


@pytest.mark.parametrize(
    "raw",
    [
        sse_event("response.created", {"id": "one"}),
        b"data: "
        + json.dumps({"type": "response.completed", "response": completed()}).encode(),
        json.dumps(completed()).encode(),
    ],
)
def test_sse_missing_complete_terminal_is_unknown_with_no_fallback(http_boundary, raw):
    install, targets = http_boundary
    install(raw=raw)
    with pytest.raises(ModelCallUncertain, match="^call_outcome_unknown$"):
        OpenAIResponsesAdapter(True, "dummy").invoke(sse_call())
    assert len(targets) == 1


@pytest.mark.parametrize(
    "kind,status",
    [("response.failed", "failed"), ("response.incomplete", "incomplete")],
)
def test_sse_terminal_failure_retains_wire_and_usage(http_boundary, kind, status):
    install, _ = http_boundary
    raw = sse_event(kind, completed(status=status))
    install(raw=raw)
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(sse_call())
    assert reply.raw_response == raw and reply.output is None
    assert reply.usage == {"input_tokens": 5, "output_tokens": 7, "total_tokens": 12}
    assert reply.error_code == "invalid_output"


def test_sse_no_usage_is_unknown_rather_than_zero(http_boundary):
    install, _ = http_boundary
    install(raw=sse_event("response.completed", completed(usage=None)))
    reply = OpenAIResponsesAdapter(True, "dummy").invoke(sse_call())
    assert reply.error_code is None and reply.usage is None
