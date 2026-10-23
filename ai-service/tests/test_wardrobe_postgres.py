"""Real task-owned PostgreSQL/Saver/Worker recovery. Only the model is a double."""

import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from hashlib import sha256
from importlib.resources import files
from pathlib import Path
from threading import Barrier, Event
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg import errors
from psycopg.pq import TransactionStatus
from psycopg.types.json import Jsonb
from pydantic import SecretStr
from test_model_adapter import completed, sse_event
from test_model_adapter import http_boundary as http_boundary
from test_postgres import (
    TOKEN,
)
from test_postgres import (
    environment as environment,
)
from test_postgres import (
    owned_database as owned_database,
)
from test_wardrobe import FakeModel
from wardrobe_fixtures import choice, wardrobe_input

from ai_service.agent_core.contracts import WorkerAuthorityLost, request_hash
from ai_service.agent_core.model import ModelCallUncertain
from ai_service.api.app import create_app
from ai_service.config import Settings
from ai_service.infrastructure.migrate import migrate
from ai_service.infrastructure.store import WORKER_LOCK, OperationSession, Store
from ai_service.worker import process_next, worker_connection
from ai_service.workflows.echo import execute_echo

pytestmark = pytest.mark.integration


class ProcessCrash(BaseException):
    """A process-death boundary must not be converted into a normal failed result."""


@pytest.fixture
def runtime(environment):
    base, _, store = environment
    config = base.model_copy(
        update={"model_enabled": True, "model_name": "boundary-test-model"}
    )
    with TestClient(
        create_app(config), headers={"Authorization": "Bearer " + TOKEN}
    ) as client:
        yield config, client, store


def create(client, key="wardrobe", payload=None):
    response = client.post(
        "/api/v1/runs",
        json={
            "workflow": "wardrobe.recommend.v1",
            "input": wardrobe_input() if payload is None else payload,
        },
        headers={"Idempotency-Key": key},
    )
    assert response.status_code == 202, response.text
    return response.json()


def operation(store, run_id):
    with store.connect() as conn:
        return conn.execute(
            "SELECT * FROM ai_operations WHERE run_id=%s", (run_id,)
        ).fetchone()


@pytest.mark.parametrize("known_usage", [False, True])
def test_api_worker_prepare_commit_precedes_one_send_and_result_is_controlled(
    runtime, known_usage
):
    config, client, store = runtime
    queued = create(client)
    run_id = queued["run_id"]
    model = FakeModel()
    usage = (
        {"input_tokens": 19, "output_tokens": 7, "total_tokens": 26}
        if known_usage
        else None
    )
    with worker_connection(store) as connection:
        original = model.invoke

        def inspect_then_send(call):
            assert connection.info.transaction_status == TransactionStatus.IDLE
            with store.connect() as observer:
                saved = PostgresSaver(observer).get_tuple(
                    {"configurable": {"thread_id": run_id}}
                )
                prepared = saved.checkpoint["channel_values"]["prepared"]
                assert prepared["request_hash"] == sha256(call.payload).hexdigest()
                row = observer.execute(
                    "SELECT * FROM ai_operations WHERE run_id=%s", (run_id,)
                ).fetchone()
                assert row["state"] == "sending" and row["send_count"] == 1
                assert bytes(row["request_body"]) == call.payload
            return replace(original(call), usage=usage)

        model.invoke = inspect_then_send
        assert process_next(config, store, connection, model_port=model)
        assert not process_next(config, store, connection, model_port=model)
    result = client.get("/api/v1/runs/" + run_id + "/result")
    assert result.status_code == 200, result.text
    assert result.json()["selected_ids"] == choice()["selected_ids"]
    assert result.json()["call_evidence"]["usage"] == usage
    row = operation(store, run_id)
    assert (
        row["state"] == "responded" and model.calls == 1 and bytes(row["raw_response"])
    )
    assert row["usage"] == usage
    assert row["response_ref"] == __import__("uuid").UUID(
        result.json()["call_evidence"]["response_ref"]
    )
    snapshot = client.get("/api/v1/runs/" + run_id).json()
    assert snapshot["status"] == "completed" and snapshot["cancel_requested"] is False
    assert all(
        key not in snapshot
        for key in ["execution_descriptor", "raw_response", "request_body", "scope"]
    )
    before = client.get("/api/v1/runs/" + run_id + "/events").json()
    assert client.post("/api/v1/runs/" + run_id + "/cancel").json() == snapshot
    assert client.get("/api/v1/runs/" + run_id + "/events").json() == before
    # The one-slot invariant is a database constraint, not just an in-memory counter.
    with store.connect() as conn:
        with pytest.raises(errors.UniqueViolation), conn.transaction():
            conn.execute(
                "INSERT INTO ai_operations(operation_id,run_id,input_hash,execution_hash,request_hash,request_body,state) VALUES (%s,%s,'x','x','x','x','sending')",
                (uuid4(), run_id),
            )
        with pytest.raises(errors.CheckViolation), conn.transaction():
            conn.execute(
                "UPDATE ai_operations SET send_count=2 WHERE run_id=%s", (run_id,)
            )


def test_prepare_checkpoint_without_sending_recovers_and_sends_once(
    runtime, monkeypatch
):
    config, client, store = runtime
    run_id = create(client)["run_id"]
    model = FakeModel()
    original = OperationSession.begin

    def before_sending(session, rid, prepared):
        assert session.connection.info.transaction_status == TransactionStatus.IDLE
        with store.connect() as observer:
            saved = PostgresSaver(observer).get_tuple(
                {"configurable": {"thread_id": rid}}
            )
            assert (
                saved.checkpoint["channel_values"]["prepared"]["request_hash"]
                == prepared["request_hash"]
            )
            assert (
                observer.execute(
                    "SELECT 1 FROM ai_operations WHERE run_id=%s", (rid,)
                ).fetchone()
                is None
            )
        raise ProcessCrash()

    with monkeypatch.context() as patch:
        patch.setattr(OperationSession, "begin", before_sending)
        with worker_connection(store) as connection, pytest.raises(ProcessCrash):
            process_next(config, store, connection, model_port=model)
    assert model.calls == 0 and operation(store, run_id) is None
    assert client.get("/api/v1/runs/" + run_id).json()["status"] == "running"
    with worker_connection(store) as connection:
        assert process_next(config, store, connection, model_port=model)
    assert (
        model.calls == 1
        and client.get("/api/v1/runs/" + run_id).json()["status"] == "completed"
    )
    assert OperationSession.begin is original


def test_sending_crash_recovery_is_unknown_without_second_send(runtime):
    config, client, store = runtime
    run_id = create(client)["run_id"]

    class Crashing(FakeModel):
        def invoke(self, call):
            self.calls += 1
            raise ProcessCrash()

    model = Crashing()
    with worker_connection(store) as connection, pytest.raises(ProcessCrash):
        process_next(config, store, connection, model_port=model)
    assert operation(store, run_id)["state"] == "sending" and model.calls == 1
    restarted = FakeModel(enabled=False)
    with worker_connection(store) as connection:
        assert process_next(config, store, connection, model_port=restarted)
    row = operation(store, run_id)
    view = client.get("/api/v1/runs/" + run_id).json()
    assert (
        row["state"] == "unknown"
        and row["raw_response"] is None
        and row["usage"] is None
    )
    assert (
        view["status"] == "failed"
        and view["error_code"] == "call_outcome_unknown"
        and view["output"] is None
    )
    assert restarted.calls == 0 and model.calls == 1


@pytest.mark.parametrize("field", ["prompt", "schema", "max_output_tokens"])
def test_self_consistent_checkpoint_hash_cannot_change_frozen_request(
    runtime, monkeypatch, field
):
    config, client, store = runtime
    run_id = create(client)["run_id"]
    model = FakeModel()

    def before_sending(*args):
        raise ProcessCrash()

    with monkeypatch.context() as patch:
        patch.setattr(OperationSession, "begin", before_sending)
        with worker_connection(store) as connection, pytest.raises(ProcessCrash):
            process_next(config, store, connection, model_port=model)
    # Alter an actual saved checkpoint, including its self-consistent request hash.
    # The server descriptor/resources remain the authority for the entire body.
    with store.connect() as connection:
        saver = PostgresSaver(connection)
        saved = saver.get_tuple({"configurable": {"thread_id": run_id}})
        checkpoint = saved.checkpoint
        prepared = checkpoint["channel_values"]["prepared"]
        body = json.loads(prepared["request_body"])
        if field == "prompt":
            body["input"][0]["content"][0]["text"] = "changed prompt"
        elif field == "schema":
            body["text"]["format"]["schema"] = {"type": "object"}
        else:
            body["max_output_tokens"] += 1
        prepared["request_body"] = json.dumps(
            body, sort_keys=True, separators=(",", ":"), ensure_ascii=False
        )
        prepared["request_hash"] = sha256(prepared["request_body"].encode()).hexdigest()
        version = saver.get_next_version(
            checkpoint["channel_versions"]["prepared"], None
        )
        checkpoint["channel_versions"]["prepared"] = version
        saver.put(saved.config, checkpoint, saved.metadata, {"prepared": version})
        assert (
            saver.get_tuple(saved.config).checkpoint["channel_values"]["prepared"]
            == prepared
        )
    with worker_connection(store) as connection:
        assert process_next(config, store, connection, model_port=model)
    view = client.get("/api/v1/runs/" + run_id).json()
    assert view["status"] == "failed" and view["error_code"] == "operation_mismatch"
    assert model.calls == 0 and operation(store, run_id) is None


def test_persisted_response_survives_independent_cli_with_disabled_model(
    runtime, monkeypatch, tmp_path
):
    config, client, store = runtime
    run_id = create(client)["run_id"]
    model = FakeModel()
    original = OperationSession.respond

    def after_response(session, *args):
        original(session, *args)
        raise ProcessCrash()

    with monkeypatch.context() as patch:
        patch.setattr(OperationSession, "respond", after_response)
        with worker_connection(store) as connection, pytest.raises(ProcessCrash):
            process_next(config, store, connection, model_port=model)
    row = operation(store, run_id)
    assert row["state"] == "responded" and row["raw_response"] and model.calls == 1
    environment = {
        **os.environ,
        "AI_DATABASE_URL": config.database_url,
        "AI_API_KEY": TOKEN,
        "AI_SCOPE": config.scope,
        "AI_MODEL_ENABLED": "false",
        "AI_MODEL_NAME": "",
        "AI_MODEL_API_KEY": "",
    }
    environment.pop("PYTHONPATH", None)
    completed = subprocess.run(
        [sys.executable, "-m", "ai_service", "worker", "--once"],
        cwd=tmp_path,
        env=environment,
        text=True,
        capture_output=True,
        timeout=30,
    )
    assert completed.returncode == 0, completed.stdout + completed.stderr
    result = client.get("/api/v1/runs/" + run_id + "/result")
    assert result.status_code == 200, result.text
    assert result.json()["call_evidence"]["response_ref"] == str(row["response_ref"])
    assert model.calls == 1 and operation(store, run_id)["send_count"] == 1


def test_network_uncertainty_and_invalid_output_are_not_repaired(runtime):
    config, client, store = runtime

    class Uncertain(FakeModel):
        def invoke(self, call):
            self.calls += 1
            raise ModelCallUncertain("call_outcome_unknown")

    unknown = create(client, key="unknown")["run_id"]
    model = Uncertain()
    with worker_connection(store) as conn:
        assert process_next(config, store, conn, model_port=model)
    assert operation(store, unknown)["state"] == "unknown" and model.calls == 1
    invalid = create(client, key="invalid")["run_id"]
    bad = FakeModel({**choice(), "fact_refs": ["invented"]})
    with worker_connection(store) as conn:
        assert process_next(config, store, conn, model_port=bad)
    view = client.get("/api/v1/runs/" + invalid).json()
    assert (
        view["status"] == "failed"
        and view["error_code"] == "invalid_output"
        and bad.calls == 1
    )
    assert (
        operation(store, invalid)["state"] == "responded"
        and operation(store, invalid)["raw_response"]
    )


def test_cancel_queued_and_inflight_late_reply_preserves_terminal_and_evidence(runtime):
    config, client, store = runtime
    queued = create(client, key="cancel-queued")["run_id"]
    base = "/api/v1/runs/" + queued
    cancelled = client.post(base + "/cancel").json()
    assert cancelled["status"] == "cancelled" and cancelled["cancel_requested"] is True
    assert client.post(base + "/cancel").json() == cancelled
    assert [x["sequence"] for x in client.get(base + "/events").json()] == [1, 2]
    with worker_connection(store) as conn:
        assert not process_next(config, store, conn, model_port=FakeModel())
    assert operation(store, queued) is None
    active = create(client, key="cancel-running")["run_id"]
    base = "/api/v1/runs/" + active
    entered, resume = Event(), Event()

    class Paused(FakeModel):
        def invoke(self, call):
            entered.set()
            assert resume.wait(timeout=10)
            return super().invoke(call)

    model = Paused()

    def work():
        with worker_connection(store) as conn:
            return process_next(config, store, conn, model_port=model)

    with ThreadPoolExecutor(max_workers=1) as pool:
        worker = pool.submit(work)
        try:
            assert entered.wait(timeout=10)
            terminal = client.post(base + "/cancel").json()
            assert terminal["status"] == "cancelled"
        finally:
            resume.set()
        assert worker.result(timeout=10)
    assert client.get(base).json() == terminal
    assert client.get(base + "/result").status_code == 409
    events = client.get(base + "/events").json()
    assert [e["event_type"] for e in events] == [
        "queued",
        "running",
        "cancel_requested",
        "cancelled",
    ]
    assert [e["sequence"] for e in events] == [1, 2, 3, 4]
    assert operation(store, active)["state"] == "responded" and model.calls == 1


def test_atomic_cancel_finish_race_has_only_one_terminal_event(environment):
    config, client, store = environment
    response = client.post(
        "/api/v1/runs",
        json={"input": {"text": "race"}},
        headers={"Idempotency-Key": "race"},
    )
    rid = response.json()["run_id"]
    barrier = Barrier(2)
    with worker_connection(store) as conn:
        store.claim_next(conn)

        def finish():
            barrier.wait(timeout=10)
            store.finish(conn, rid, {"text": "race"})

        def cancel():
            barrier.wait(timeout=10)
            return store.cancel(config.scope, rid)

        with ThreadPoolExecutor(max_workers=2) as pool:
            a, b = pool.submit(finish), pool.submit(cancel)
            a.result(timeout=10)
            b.result(timeout=10)
    view = client.get("/api/v1/runs/" + rid).json()
    events = client.get("/api/v1/runs/" + rid + "/events").json()
    assert view["status"] in {"completed", "cancelled"}
    assert (
        len(
            [
                e
                for e in events
                if e["event_type"] in {"completed", "cancelled", "failed"}
            ]
        )
        == 1
    )
    assert [e["sequence"] for e in events] == list(range(1, view["last_sequence"] + 1))
    assert (view["output"] == {"text": "race"}) == (view["status"] == "completed")


def test_lost_actual_worker_connection_cannot_reconnect_or_write_late_evidence(
    runtime, monkeypatch
):
    config, client, store = runtime
    rid = create(client)["run_id"]
    model = FakeModel()
    with worker_connection(store) as conn:
        original = model.invoke

        def lose_session(call):
            reply = original(call)
            with psycopg.connect(config.database_url, autocommit=True) as killer:
                assert killer.execute(
                    "SELECT pg_terminate_backend(%s)", (conn.info.backend_pid,)
                ).fetchone()[0]
            return reply

        model.invoke = lose_session
        with monkeypatch.context() as patch:
            patch.setattr(
                store,
                "connect",
                lambda: pytest.fail("Old Worker attempted a replacement connection"),
            )
            with pytest.raises(psycopg.Error):
                process_next(config, store, conn, model_port=model)
    assert (
        operation(store, rid)["state"] == "sending"
        and operation(store, rid)["raw_response"] is None
    )
    assert client.get("/api/v1/runs/" + rid).json()["status"] == "running"
    replacement = FakeModel()
    with worker_connection(store) as conn:
        assert process_next(config, store, conn, model_port=replacement)
    assert replacement.calls == 0 and model.calls == 1
    assert (
        client.get("/api/v1/runs/" + rid).json()["error_code"] == "call_outcome_unknown"
    )


def test_explicit_unlock_revokes_old_session_writes(environment):
    config, client, store = environment
    with worker_connection(store) as conn:
        assert conn.execute("SELECT pg_advisory_unlock(%s)", (WORKER_LOCK,)).fetchone()[
            "pg_advisory_unlock"
        ]
        with pytest.raises(WorkerAuthorityLost):
            store.claim_next(conn)


def test_frozen_execution_survives_current_config_change_and_same_key(runtime):
    config, client, store = runtime
    queued = create(client)
    rid = queued["run_id"]
    other_config = config.model_copy(
        update={
            "model_name": "different-server-model",
            "model_max_output_tokens": 4096,
            "model_enabled": True,
        }
    )
    other = TestClient(create_app(other_config), headers=client.headers)
    assert create(other)["run_id"] == rid
    model = FakeModel()
    seen = []
    original = model.invoke

    def inspect(call):
        seen.append(json.loads(call.payload))
        return original(call)

    model.invoke = inspect
    with worker_connection(store) as conn:
        assert process_next(other_config, store, conn, model_port=model)
    assert (
        seen[0]["model"] == "boundary-test-model"
        and seen[0]["max_output_tokens"] == 2048
    )
    assert (
        client.get("/api/v1/runs/" + rid + "/result").json()["call_evidence"][
            "requested_model"
        ]
        == "boundary-test-model"
    )


def test_old_sql_checksum_data_and_actual_echo_checkpoint_survive_upgrade(
    owned_database,
):
    config = Settings(
        _env_file=None, database_url=owned_database, api_key=TOKEN, scope="legacy"
    )
    old = (
        files("ai_service.infrastructure")
        .joinpath("migrations/0001_runtime.sql")
        .read_text()
    )
    checksum = sha256(old.encode()).hexdigest()
    rid = uuid4()
    store = Store(owned_database)
    with store.connect() as conn, conn.transaction():
        conn.execute(
            "CREATE TABLE ai_schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())"
        )
        conn.execute(old)
        conn.execute(
            "INSERT INTO ai_schema_migrations(version,checksum) VALUES (%s,%s)",
            ("0001_runtime.sql", checksum),
        )
        conn.execute(
            "INSERT INTO ai_runs(run_id,scope,request_key,request_hash,workflow,input,status,last_sequence) VALUES (%s,'legacy','legacy',%s,'echo.v1',%s,'running',2)",
            (
                rid,
                request_hash("echo.v1", {"text": "legacy-checkpoint"}),
                Jsonb({"text": "legacy-checkpoint"}),
            ),
        )
        conn.execute("INSERT INTO ai_commands(run_id) VALUES (%s)", (rid,))
        for seq, state in [(1, "queued"), (2, "running")]:
            conn.execute(
                "INSERT INTO ai_events(run_id,sequence,event_type,payload) VALUES (%s,%s,%s,%s)",
                (rid, seq, state, Jsonb({"status": state})),
            )
    with PostgresSaver.from_conn_string(owned_database) as saver:
        saver.setup()
    with store.connect() as conn:
        execute_echo(str(rid), "legacy-checkpoint", PostgresSaver(conn))
    migrate(config)
    with worker_connection(store) as conn:
        assert process_next(config, store, conn)
    view = store.get("legacy", str(rid))
    assert (
        view["output"] == {"text": "legacy-checkpoint"}
        and view["status"] == "completed"
        and view["cancel_requested"] is False
    )
    with store.connect() as conn:
        assert (
            conn.execute(
                "SELECT checksum FROM ai_schema_migrations WHERE version=%s",
                ("0001_runtime.sql",),
            ).fetchone()["checksum"]
            == checksum
        )
        row = conn.execute(
            "SELECT execution_descriptor FROM ai_runs WHERE run_id=%s", (rid,)
        ).fetchone()
        assert row["execution_descriptor"] is None
        assert (
            conn.execute("SELECT count(*) AS n FROM ai_operations").fetchone()["n"] == 0
        )
    assert [e["sequence"] for e in store.events("legacy", str(rid), 0)] == [1, 2, 3]


def test_actual_http_responses_capture_scope_config_failure_and_echo(environment):
    config, client, store = environment
    captured = {}
    queued = create(client)
    captured["disabled_queued"] = queued
    rid = queued["run_id"]
    with worker_connection(store) as conn:
        assert process_next(config, store, conn)
    captured["disabled_failed"] = client.get("/api/v1/runs/" + rid).json()
    assert (
        captured["disabled_failed"]["error_code"] == "model_not_configured"
        and operation(store, rid) is None
    )
    other = TestClient(
        create_app(config.model_copy(update={"scope": "other"})), headers=client.headers
    )
    for suffix in ["", "/events", "/result"]:
        assert other.get("/api/v1/runs/" + rid + suffix).status_code == 404
    assert other.post("/api/v1/runs/" + rid + "/cancel").status_code == 404
    enabled = config.model_copy(
        update={"model_enabled": True, "model_name": "boundary-test-model"}
    )
    enabled_client = TestClient(create_app(enabled), headers=client.headers)
    captured["wardrobe_queued"] = create(enabled_client, key="successful")
    rid = captured["wardrobe_queued"]["run_id"]
    model = FakeModel()
    with worker_connection(store) as conn:
        assert process_next(enabled, store, conn, model_port=model)
    captured["wardrobe_completed"] = enabled_client.get("/api/v1/runs/" + rid).json()
    captured["wardrobe_result"] = enabled_client.get(
        "/api/v1/runs/" + rid + "/result"
    ).json()
    captured["wardrobe_events"] = enabled_client.get(
        "/api/v1/runs/" + rid + "/events"
    ).json()
    cancel_id = create(enabled_client, key="cancelled")["run_id"]
    captured["cancelled"] = enabled_client.post(
        "/api/v1/runs/" + cancel_id + "/cancel"
    ).json()
    response = client.post(
        "/api/v1/runs",
        json={"input": {"text": "echo-preserved"}},
        headers={"Idempotency-Key": "echo"},
    )
    assert response.status_code == 202
    echo_id = response.json()["run_id"]
    with worker_connection(store) as conn:
        assert process_next(config, store, conn)
    captured["echo_completed"] = client.get("/api/v1/runs/" + echo_id).json()
    assert captured["echo_completed"]["output"] == {"text": "echo-preserved"}
    output = os.getenv("AI_RUNTIME_CONSUMER_RESPONSES")
    if output:
        expected = (
            Path(__file__).resolve().parents[2]
            / ".tools/manager-runtime/ai-runtime-responses.json"
        )
        assert Path(output).resolve() == expected.resolve()
        expected.parent.mkdir(parents=True, exist_ok=True)
        expected.write_text(json.dumps(captured, ensure_ascii=False, indent=2) + "\n")


@pytest.mark.parametrize("crash_after_response", [False, True])
def test_configured_sse_gateway_raw_response_survives_worker_and_disabled_cli_recovery(
    environment, http_boundary, monkeypatch, tmp_path, crash_after_response
):
    base, _, store = environment
    config = base.model_copy(
        update={
            "model_enabled": True,
            "model_name": "gateway-model",
            "model_api_key": SecretStr("synthetic-gateway-key"),
            "model_base_url": "http://gateway.invalid:8081/v1",
            "model_response_transport": "responses-sse.v1",
            "model_reasoning_effort": "medium",
        }
    )
    body = completed(id="sse-response")
    body["output"][0]["content"][0]["text"] = json.dumps(choice())
    raw = sse_event("response.completed", body)
    install, targets = http_boundary
    install(raw=raw)
    with TestClient(
        create_app(config), headers={"Authorization": "Bearer " + TOKEN}
    ) as client:
        run_id = create(client)["run_id"]
        original = OperationSession.respond

        def stop_after_persist(session, *args):
            original(session, *args)
            raise ProcessCrash()

        with monkeypatch.context() as patch:
            if crash_after_response:
                patch.setattr(OperationSession, "respond", stop_after_persist)
            with worker_connection(store) as conn:
                if crash_after_response:
                    with pytest.raises(ProcessCrash):
                        process_next(config, store, conn)
                else:
                    assert process_next(config, store, conn)
        row = operation(store, run_id)
        assert row["state"] == "responded" and bytes(row["raw_response"]) == raw
        assert json.loads(bytes(row["request_body"]))["stream"] is True
        if crash_after_response:
            child_env = {
                **os.environ,
                "AI_DATABASE_URL": config.database_url,
                "AI_API_KEY": TOKEN,
                "AI_SCOPE": config.scope,
                "AI_MODEL_ENABLED": "false",
                "AI_MODEL_API_KEY": "",
                "AI_MODEL_BASE_URL": "https://api.openai.com/v1",
                "AI_MODEL_RESPONSE_TRANSPORT": "responses-json.v1",
            }
            child_env.pop("PYTHONPATH", None)
            restored = subprocess.run(
                [sys.executable, "-m", "ai_service", "worker", "--once"],
                cwd=tmp_path,
                env=child_env,
                capture_output=True,
                text=True,
                timeout=30,
            )
            assert restored.returncode == 0, restored.stdout + restored.stderr
        output = client.get("/api/v1/runs/" + run_id + "/result")
        assert output.status_code == 200, output.text
        assert output.json()["call_evidence"]["usage"] == body["usage"]
        assert operation(store, run_id)["send_count"] == 1
        assert targets == [("gateway.invalid", 8081, config.model_timeout_seconds)]


def test_legacy_descriptor_without_gateway_or_reason_policy_keeps_original_json_request(
    environment, http_boundary
):
    from ai_service.infrastructure.execution import resources

    base, _, store = environment
    config = base.model_copy(
        update={
            "model_enabled": True,
            "model_name": "configured-model",
            "model_api_key": SecretStr("synthetic-key"),
        }
    )
    body = completed()
    body["output"][0]["content"][0]["text"] = json.dumps(choice())
    install, targets = http_boundary
    install(body=body)
    with TestClient(
        create_app(config), headers={"Authorization": "Bearer " + TOKEN}
    ) as client:
        run_id = create(client)["run_id"]
        with store.connect() as conn:
            spec = conn.execute(
                "SELECT execution_descriptor FROM ai_runs WHERE run_id=%s", (run_id,)
            ).fetchone()["execution_descriptor"]
            for key in (
                "response_transport",
                "reasoning_effort",
                "reason_policy_version",
                "reason_policy_sha256",
            ):
                spec.pop(key, None)
            conn.execute(
                "UPDATE ai_runs SET execution_descriptor=%s WHERE run_id=%s",
                (Jsonb(spec), run_id),
            )
        with worker_connection(store) as conn:
            assert process_next(config, store, conn)
        output = client.get("/api/v1/runs/" + run_id + "/result")
        assert output.status_code == 200, output.text
        request = json.loads(bytes(operation(store, run_id)["request_body"]))
        assert request["stream"] is False and "reasoning" not in request
        assert request["input"][0]["content"][0]["text"] == resources()[0]
        assert len(targets) == 1 and operation(store, run_id)["send_count"] == 1
