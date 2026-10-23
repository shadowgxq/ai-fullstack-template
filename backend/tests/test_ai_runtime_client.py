"""Offline HTTP wire tests; no AI package imports, database or network calls."""

import io
import json
from copy import deepcopy

import pytest

from app.services import ai_runtime_client as module
from app.services.ai_runtime_client import AiRuntimeClient, AiRuntimeError

RUN_ID = "11111111-1111-4111-8111-111111111111"
GARMENT_ID = "22222222-2222-4222-8222-222222222222"
OTHER_ID = "33333333-3333-4333-8333-333333333333"
KEY = "wardrobe:" + RUN_ID
TOKEN = "synthetic-service-key-for-tests"


def frozen_input():
    return {
        "candidates": [
            {
                "id": GARMENT_ID,
                "name": "测试衣物",
                "category": None,
                "color": None,
                "season": [],
                "occasion": [],
                "tags": [],
            }
        ],
        "preferences": {
            "liked_styles": [],
            "avoided_styles": [],
            "liked_colors": [],
            "avoided_colors": [],
            "liked_occasions": [],
            "avoided_occasions": [],
            "comfort_notes": "怕冷；仅供参考",
        },
        "scene": "any",
        "history": {
            "start_date": "2026-09-23",
            "end_date": "2026-10-22",
            "garments": [],
        },
        "weather": {
            "state": "missing",
            "context_id": None,
            "region_id": None,
            "weather_date": "2026-10-22",
            "facts": None,
            "missing_reason": "not_requested",
        },
        "revisions": {
            "inventory_revision": 0,
            "history_revision": 0,
            "preferences_revision": 0,
        },
        "versions": {
            "catalog_version": "1",
            "policy_version": "wardrobe.filter.v1",
            "prompt_version": "wardrobe.recommend.prompt.v1",
            "schema_version": "wardrobe.recommend.output.v1",
        },
        "fact_refs": [],
        "candidate_scope_limited": False,
    }


def run_view(**changes):
    return {
        "run_id": RUN_ID,
        "workflow": "wardrobe.recommend.v1",
        "status": "queued",
        "input": frozen_input(),
        "output": None,
        "error_code": None,
        "last_sequence": 1,
        "created_at": "2026-10-22T14:37:14.476893Z",
        "cancel_requested": False,
        **changes,
    }


def completed_output():
    return {
        "selected_ids": [GARMENT_ID],
        "reason_codes": [],
        "fact_refs": [],
        "tradeoff_codes": [
            "partial_outfit",
            "unknown_attributes",
            "weather_missing",
            "history_empty",
            "comfort_reference_only",
        ],
        "call_evidence": {
            "operation_id": RUN_ID,
            "response_ref": OTHER_ID,
            "adapter": "openai.responses.v1",
            "requested_model": "configured-model",
            "returned_model": "returned-model",
            "request_id": "request-from-header",
            "usage": None,
            "prompt_version": "wardrobe.recommend.prompt.v1",
            "schema_version": "wardrobe.recommend.output.v1",
        },
    }


class WireReader(io.RawIOBase):
    def __init__(self, owner):
        self.owner = owner

    def readable(self):
        return True

    def readinto(self, buffer):
        if self.owner.error:
            raise self.owner.error
        self.owner.clock += self.owner.delay
        data = self.owner.source.read(min(len(buffer), self.owner.chunk_size))
        buffer[: len(data)] = data
        return len(data)


class WireSocket:
    def __init__(self, wire):
        self.source = io.BytesIO(wire)
        self.sent = []
        self.timeouts = []
        self.closed = False
        self.error = None
        self.clock = 0.0
        self.delay = 0.0
        self.chunk_size = 65536

    def makefile(self, mode, buffering=-1):
        assert mode == "rb"
        raw = WireReader(self)
        return raw if buffering == 0 else io.BufferedReader(raw)

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
        body=None,
        *,
        raw=None,
        status=202,
        length=None,
        chunked=False,
        extra_headers=b"",
    ):
        data = (
            raw
            if raw is not None
            else json.dumps(run_view() if body is None else body).encode()
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
            + b" Fixture\r\n"
            + framing
            + b"Content-Type: application/json\r\n"
            + extra_headers
            + b"Connection: close\r\n\r\n"
            + data
        )
        sockets.append(sock)
        return sock

    def connect(connection):
        targets.append(
            (
                type(connection).__name__,
                connection.host,
                connection.port,
                connection.timeout,
            )
        )
        connection.sock = sockets[-1]

    monkeypatch.setattr(module._ConnectionMixin, "connect", connect)
    return install, targets


def client(**changes):
    return AiRuntimeClient(
        **{"base_url": "http://ai-runtime.internal:8000/", "api_key": TOKEN, **changes}
    )


def test_create_serializes_only_trusted_identity_and_stable_key_once(
    http_boundary, caplog
):
    install, targets = http_boundary
    data = frozen_input()
    expected = run_view()
    sock = install(expected)
    consumer = client()
    assert targets == []
    assert consumer.create_run(KEY, data) == expected
    wire = b"".join(sock.sent)
    headers, body = wire.split(b"\r\n\r\n", 1)
    assert headers.count(b"POST /api/v1/runs HTTP/1.1") == 1
    assert b"Authorization: Bearer " + TOKEN.encode() in headers
    assert b"Idempotency-Key: " + KEY.encode() in headers
    assert b"Accept-Encoding: identity" in headers
    assert json.loads(body) == {"workflow": "wardrobe.recommend.v1", "input": data}
    assert targets == [("_HTTPConnection", "ai-runtime.internal", 8000, 5)]
    assert sock.closed
    assert TOKEN not in caplog.text and "怕冷" not in caplog.text


@pytest.mark.parametrize("operation", ["get", "cancel"])
def test_get_and_cancel_use_fixed_paths_without_new_input_or_idempotency_identity(
    http_boundary, operation
):
    install, targets = http_boundary
    view = (
        run_view(status="cancelled", cancel_requested=True)
        if operation == "cancel"
        else run_view(status="running", last_sequence=2)
    )
    sock = install(view, status=200)
    consumer = client(base_url="https://ai-runtime.internal")
    result = (
        consumer.cancel_run(RUN_ID, frozen_input())
        if operation == "cancel"
        else consumer.get_run(RUN_ID, frozen_input())
    )
    assert result == view
    wire = b"".join(sock.sent)
    target = (
        b"POST /api/v1/runs/" + RUN_ID.encode() + b"/cancel"
        if operation == "cancel"
        else b"GET /api/v1/runs/" + RUN_ID.encode()
    )
    assert wire.startswith(target + b" HTTP/1.1\r\n")
    assert wire.endswith(b"\r\n\r\n") and b"Idempotency-Key" not in wire
    assert (
        targets == [("_HTTPSConnection", "ai-runtime.internal", 443, 5)] and sock.closed
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"base_url": None},
        {"api_key": None},
        {"base_url": ""},
        {"api_key": " "},
        {"api_key": "key\r\nInjected: value"},
        {"base_url": "file:///tmp/something"},
        {"base_url": "https://user:password@ai.internal"},
        {"base_url": "https://ai.internal/path"},
        {"base_url": "http://ai.internal?scope=evil"},
        {"base_url": "http://ai.internal/#fragment"},
        {"base_url": "http://ai.internal:65536"},
        {"base_url": "http://ai.internal\n.evil"},
        {"timeout_seconds": 0},
        {"timeout_seconds": True},
        {"timeout_seconds": float("inf")},
        {"max_response_bytes": 0},
        {"max_response_bytes": True},
    ],
)
def test_missing_or_invalid_configuration_constructs_offline_and_never_sends(
    monkeypatch, changes
):
    def forbidden(*args, **kwargs):
        pytest.fail("bad configuration must not construct an HTTP connection")

    monkeypatch.setattr(module, "_HTTPConnection", forbidden)
    monkeypatch.setattr(module, "_HTTPSConnection", forbidden)
    consumer = client(**changes)
    with pytest.raises(AiRuntimeError) as caught:
        consumer.create_run(KEY, frozen_input())
    assert caught.value.code == "ai_not_configured" and not caught.value.retryable
    assert str(caught.value) == "ai_not_configured"


@pytest.mark.parametrize(
    "key", [None, "", "with space", "x" * 129, "bad\r\nHeader: value"]
)
@pytest.mark.parametrize("operation", ["create_run", "cancel_by_key"])
def test_invalid_create_key_never_sends(http_boundary, key, operation):
    _, targets = http_boundary
    with pytest.raises(AiRuntimeError, match="^ai_invalid_response$"):
        getattr(client(), operation)(key, frozen_input())
    assert targets == []


@pytest.mark.parametrize(
    "run_id",
    ["../other", RUN_ID + "?owner=evil", "https://evil.invalid/", "not-a-uuid"],
)
def test_run_target_cannot_escape_fixed_resource_path(http_boundary, run_id):
    _, targets = http_boundary
    for operation in (client().get_run, client().cancel_run):
        with pytest.raises(AiRuntimeError, match="^ai_identity_mismatch$"):
            operation(run_id, frozen_input())
    assert targets == []


@pytest.mark.parametrize("bad", ["version", "nan", "nul", "surrogate", "oversize"])
def test_invalid_expected_frozen_input_is_not_sent(http_boundary, bad):
    _, targets = http_boundary
    data = frozen_input()
    if bad == "version":
        data["versions"]["prompt_version"] = "other"
    elif bad == "nan":
        data["fact_refs"] = [{"value": float("nan")}]
    elif bad == "oversize":
        data["preferences"]["comfort_notes"] = "衣" * (512 * 1024)
    else:
        data["preferences"]["comfort_notes"] = "\x00" if bad == "nul" else "\ud800"
    with pytest.raises(AiRuntimeError, match="^ai_invalid_response$"):
        client().create_run(KEY, data)
    assert targets == []


@pytest.mark.parametrize("kind", ["workflow", "run", "input", "bool-int", "text-time"])
def test_wrong_run_version_and_frozen_input_are_identity_failures(http_boundary, kind):
    install, targets = http_boundary
    view = run_view()
    expected = frozen_input()
    if kind == "workflow":
        view["workflow"] = "echo.v1"
    elif kind == "run":
        view["run_id"] = OTHER_ID
    elif kind == "input":
        view["input"]["scene"] = "work"
    elif kind == "bool-int":
        view["input"]["candidate_scope_limited"] = 0
    else:
        expected["preferences"]["comfort_notes"] = "2026-10-22T00:00:00Z"
        view["input"]["preferences"]["comfort_notes"] = "2026-10-22T08:00:00+08:00"
    install(view, status=200)
    with pytest.raises(AiRuntimeError, match="^ai_identity_mismatch$") as caught:
        client().get_run(RUN_ID, expected)
    assert not caught.value.retryable and len(targets) == 1


def test_weather_timestamp_normalization_and_float_serialization_preserve_identity(
    http_boundary,
):
    install, _ = http_boundary
    data = frozen_input()
    data["weather"].update(
        state="available",
        region_id="cn-101210101",
        missing_reason=None,
        facts={
            "source": "weather.com.cn",
            "parser_version": "weather1d.v1",
            "fetched_at": "2026-10-22T14:00:00+08:00",
            "valid_until": "2026-10-23T00:00:00+08:00",
            "observation": {
                "observed_at": "2026-10-22T13:30:00+08:00",
                "temperature_c": 0,
            },
            "forecast": None,
        },
    )
    view = run_view(input=deepcopy(data))
    view["input"]["weather"]["facts"].update(
        fetched_at="2026-10-22T06:00:00Z", valid_until="2026-10-22T16:00:00Z"
    )
    view["input"]["weather"]["facts"]["observation"].update(
        observed_at="2026-10-22T05:30:00Z", temperature_c=0.0
    )
    install(view)
    assert client().create_run(KEY, data) == view
    view["input"]["weather"]["facts"]["fetched_at"] = "2026-10-22T06:00:01Z"
    install(view)
    with pytest.raises(AiRuntimeError, match="^ai_identity_mismatch$"):
        client().create_run(KEY, data)


@pytest.mark.parametrize(
    "status,changes",
    [
        ("queued", {}),
        ("running", {"last_sequence": 2}),
        ("failed", {"error_code": "call_outcome_unknown"}),
        ("cancelled", {"cancel_requested": True}),
        ("completed", {"output": completed_output()}),
    ],
)
def test_valid_native_states_and_safe_evidence_are_preserved(
    http_boundary, status, changes
):
    install, _ = http_boundary
    view = run_view(status=status, **changes)
    install(view, status=200)
    assert client().get_run(RUN_ID, frozen_input()) == view


@pytest.mark.parametrize(
    "case",
    [
        "completed-empty",
        "completed-error",
        "running-output",
        "failed-no-code",
        "cancel-unconfirmed",
        "sequence-bool",
        "sequence-negative",
        "cancel-string",
        "naive-created",
        "numeric-created",
        "extra-provider",
        "invalid-code",
    ],
)
def test_invalid_state_shape_never_becomes_a_business_run(http_boundary, case):
    install, _ = http_boundary
    view = run_view()
    if case == "completed-empty":
        view["status"] = "completed"
    elif case == "completed-error":
        view.update(
            status="completed", output=completed_output(), error_code="provider_error"
        )
    elif case == "running-output":
        view.update(status="running", output=completed_output())
    elif case == "failed-no-code":
        view["status"] = "failed"
    elif case == "cancel-unconfirmed":
        view["status"] = "cancelled"
    elif case in ("sequence-bool", "sequence-negative"):
        view["last_sequence"] = True if case == "sequence-bool" else -1
    elif case == "cancel-string":
        view["cancel_requested"] = "false"
    elif case in ("naive-created", "numeric-created"):
        view["created_at"] = (
            "2026-10-22T00:00:00" if case == "naive-created" else 1792627200
        )
    elif case == "extra-provider":
        view["raw_response"] = "private-provider-output"
    else:
        view.update(status="failed", error_code="private provider error text")
    install(view)
    with pytest.raises(AiRuntimeError, match="^ai_invalid_response$") as caught:
        client().create_run(KEY, frozen_input())
    assert not caught.value.retryable


@pytest.mark.parametrize(
    "case",
    [
        "unknown-id",
        "duplicate-id",
        "unknown-ref",
        "wrong-subject",
        "duplicate-code",
        "guarantee",
        "free-text",
        "bad-usage",
        "large-model",
        "large-request-id",
        "raw-evidence",
        "bad-version",
    ],
)
def test_output_controlled_structure_and_membership_are_checked_before_return(
    http_boundary, case
):
    install, _ = http_boundary
    data = frozen_input()
    output = completed_output()
    if case == "unknown-id":
        output["selected_ids"] = [OTHER_ID]
    elif case == "duplicate-id":
        output["selected_ids"] *= 2
    elif case == "unknown-ref":
        output["fact_refs"] = ["invented"]
    elif case == "wrong-subject":
        data["candidates"].append({**data["candidates"][0], "id": OTHER_ID})
        data["fact_refs"] = [
            {
                "ref_id": "other:name",
                "kind": "garment",
                "subject_id": OTHER_ID,
                "field": "name",
                "value": "other",
            }
        ]
        output["fact_refs"] = ["other:name"]
    elif case == "duplicate-code":
        output["reason_codes"] = ["known_attributes"] * 2
    elif case == "guarantee":
        output["reason_codes"] = ["comfort_matched"]
    elif case == "free-text":
        output["raw_reason"] = "unsafe model free text"
    elif case == "bad-usage":
        output["call_evidence"]["usage"] = {
            "input_tokens": True,
            "output_tokens": 0,
            "total_tokens": 0,
        }
    elif case == "large-model":
        output["call_evidence"]["returned_model"] = "m" * 129
    elif case == "large-request-id":
        output["call_evidence"]["request_id"] = "r" * 201
    elif case == "raw-evidence":
        output["call_evidence"]["raw_response"] = "private"
    else:
        output["call_evidence"]["prompt_version"] = "other"
    install(run_view(status="completed", input=data, output=output))
    with pytest.raises(AiRuntimeError, match="^ai_invalid_response$"):
        client().create_run(KEY, data)


@pytest.mark.parametrize(
    "raw",
    [
        b"not JSON",
        b"\xff",
        b"[]",
        b'{"run_id":"a","run_id":"b"}',
        b'{"x":NaN}',
        b'{"x":Infinity}',
        b'{"x":1e999}',
        b'{"x":"\\u0000"}',
        b'{"x":"\\ud800"}',
    ],
)
def test_complete_malformed_json_and_unicode_are_safe_nonretryable_errors(
    http_boundary, raw
):
    install, targets = http_boundary
    install(raw=raw)
    with pytest.raises(AiRuntimeError, match="^ai_invalid_response$") as caught:
        client().create_run(KEY, frozen_input())
    assert not caught.value.retryable and len(targets) == 1
    assert raw.decode(errors="replace") not in str(caught.value)


@pytest.mark.parametrize(
    "status,code,retryable",
    [
        (302, "ai_invalid_response", False),
        (401, "ai_not_configured", False),
        (403, "ai_not_configured", False),
        (404, "ai_identity_mismatch", False),
        (409, "ai_identity_mismatch", False),
        (422, "ai_invalid_response", False),
        (408, "ai_unavailable", True),
        (429, "ai_unavailable", True),
        (500, "ai_unavailable", True),
        (503, "ai_unavailable", True),
    ],
)
def test_http_failure_policy_does_not_follow_redirect_or_retry(
    http_boundary, status, code, retryable, caplog
):
    install, targets = http_boundary
    sock = install(
        raw=b'{"detail":"private remote details"}',
        status=status,
        extra_headers=b"Location: https://evil.invalid/token\r\n",
    )
    with pytest.raises(AiRuntimeError) as caught:
        client().create_run(KEY, frozen_input())
    assert caught.value.code == code and caught.value.retryable is retryable
    assert str(caught.value) == code and len(targets) == 1 and sock.closed
    assert b"evil.invalid" not in b"".join(sock.sent)
    assert "private remote details" not in caplog.text and TOKEN not in caplog.text


@pytest.mark.parametrize(
    "case",
    [
        "declared-oversize",
        "chunked-oversize",
        "truncated",
        "timeout",
        "disconnect",
        "bad-chunk",
    ],
)
def test_incomplete_or_unbounded_http_is_closed_with_safe_policy(http_boundary, case):
    install, targets = http_boundary
    if case == "declared-oversize":
        sock = install(raw=b"x", length=65)
    elif case == "chunked-oversize":
        sock = install(raw=b"41\r\n" + b"x" * 65 + b"\r\n0\r\n\r\n", chunked=True)
    elif case == "truncated":
        sock = install(raw=b"short", length=50)
    elif case == "bad-chunk":
        sock = install(raw=b"5\r\nabc", chunked=True)
    else:
        sock = install(raw=b"x")
        sock.error = (
            TimeoutError("private timeout")
            if case == "timeout"
            else ConnectionResetError("private network")
        )
    code = "ai_invalid_response" if "oversize" in case else "ai_unavailable"
    with pytest.raises(AiRuntimeError, match="^" + code + "$") as caught:
        client(max_response_bytes=64).create_run(KEY, frozen_input())
    assert caught.value.retryable is (code == "ai_unavailable")
    assert len(targets) == 1 and sock.closed


def test_exact_response_limit_and_chunk_framing_are_consumed(http_boundary):
    install, _ = http_boundary
    view = run_view()
    raw = json.dumps(view).encode()
    sock = install(
        raw=f"{len(raw):x}\r\n".encode() + raw + b"\r\n0\r\n\r\n", chunked=True
    )
    assert client(max_response_bytes=len(raw)).create_run(KEY, frozen_input()) == view
    assert sock.closed


def test_slow_headers_share_one_remaining_deadline(http_boundary, monkeypatch):
    install, targets = http_boundary
    sock = install()
    sock.chunk_size, sock.delay = 1, 0.4
    monkeypatch.setattr(module.time, "monotonic", lambda: sock.clock)
    with pytest.raises(AiRuntimeError, match="^ai_unavailable$") as caught:
        client(timeout_seconds=1).create_run(KEY, frozen_input())
    assert caught.value.retryable and len(targets) == 1
    assert 0 < sock.clock <= 1.3 and all(0 < timeout <= 1 for timeout in sock.timeouts)
    assert sock.closed


def test_connect_failure_does_not_automatically_repeat_or_expose_original_error(
    monkeypatch,
):
    attempts = []

    def fail(connection):
        attempts.append(connection.host)
        raise OSError("private host or credentials")

    monkeypatch.setattr(module._ConnectionMixin, "connect", fail)
    with pytest.raises(AiRuntimeError, match="^ai_unavailable$") as caught:
        client().create_run(KEY, frozen_input())
    assert caught.value.retryable and attempts == ["ai-runtime.internal"]
    assert caught.value.__cause__ is None


@pytest.mark.parametrize("state", ["cancelled", "completed", "failed"])
def test_cancel_by_key_cleans_up_unknown_run_without_creating_or_second_http(
    http_boundary, state
):
    install, targets = http_boundary
    view = run_view(
        run_id=OTHER_ID,
        status=state,
        cancel_requested=state == "cancelled",
        output=completed_output() if state == "completed" else None,
        error_code="invalid_output" if state == "failed" else None,
    )
    sock = install(view, status=200)
    assert client().cancel_by_key(KEY, frozen_input()) == view
    wire = b"".join(sock.sent)
    headers, body = wire.split(b"\r\n\r\n", 1)
    assert headers.startswith(b"POST /api/v1/runs/cancel-by-key HTTP/1.1\r\n")
    assert b"Idempotency-Key: " + KEY.encode() in headers
    assert json.loads(body) == {
        "workflow": "wardrobe.recommend.v1",
        "input": frozen_input(),
    }
    assert len(targets) == 1 and sock.closed


def test_cancel_by_key_still_rejects_a_different_frozen_request(http_boundary):
    install, targets = http_boundary
    view = run_view(status="cancelled", cancel_requested=True)
    view["input"]["revisions"]["inventory_revision"] = 1
    install(view, status=200)
    with pytest.raises(AiRuntimeError, match="^ai_identity_mismatch$"):
        client().cancel_by_key(KEY, frozen_input())
    assert len(targets) == 1


def test_response_is_checked_against_the_snapshot_actually_sent(
    http_boundary, monkeypatch
):
    install, _ = http_boundary
    data = frozen_input()
    view = run_view()
    install(view)
    original = module._ConnectionMixin.connect

    def mutate_after_serialization(connection):
        data["scene"] = "work"
        original(connection)

    monkeypatch.setattr(module._ConnectionMixin, "connect", mutate_after_serialization)
    assert client().create_run(KEY, data) == view
    assert data["scene"] == "work"
