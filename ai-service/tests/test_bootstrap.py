"""Actual offline LangGraph, CLI, diagnostics and safe logging regression tests."""

import json
import logging
from types import SimpleNamespace

import psycopg
import pytest
from langgraph.checkpoint.memory import InMemorySaver

from ai_service.cli import main
from ai_service.diagnostics import check_offline
from ai_service.infrastructure.logging import JsonFormatter
from ai_service.workflows import echo as workflow


def test_offline_check_never_connects_or_reads_live_configuration(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Offline initialization attempted a database/network call")

    import socket

    monkeypatch.setattr(psycopg, "connect", forbidden)
    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setenv("AI_DATABASE_URL", "invalid-live-value")
    monkeypatch.setenv("AI_API_KEY", "private-live-value")
    result = check_offline()
    assert result["status"] == "ok"
    assert result["postgresql"] == "not_checked"
    assert "private-live-value" not in json.dumps(result)


def test_cli_check_failure_has_nonzero_status_and_redacts_details(monkeypatch, capsys):
    def fail():
        raise RuntimeError("password=secret")

    monkeypatch.setattr("ai_service.diagnostics.check_offline", fail)
    assert main(["check"]) == 1
    captured = capsys.readouterr()
    assert json.loads(captured.err) == {
        "status": "failed",
        "error_type": "RuntimeError",
    }
    assert "secret" not in captured.err


def test_worker_cli_forwards_once_without_starting_an_api(monkeypatch):
    calls = []
    monkeypatch.setattr("ai_service.worker.main", lambda argv: calls.append(argv))
    assert main(["worker", "--once"]) == 0
    assert calls == [["--once"]]


def test_no_subcommand_does_not_start_any_service():
    with pytest.raises(SystemExit) as error:
        main([])
    assert error.value.code == 2


@pytest.mark.parametrize("resume", [False, True])
def test_start_and_resume_explicitly_use_sync_durability(monkeypatch, resume):
    calls = []

    def invoke(value, config, *, durability):
        calls.append((value, durability))
        return {"text": "hello", "result": {"text": "hello"}}

    graph = SimpleNamespace(
        get_state=lambda _config: SimpleNamespace(
            values={"text": "hello"} if resume else {}, next=("echo",)
        ),
        invoke=invoke,
    )
    monkeypatch.setattr(workflow, "build_graph", lambda _saver: graph)
    assert workflow.execute_echo("run", "hello", object()) == {"text": "hello"}
    assert calls == [(None if resume else {"text": "hello"}, "sync")]


def test_mismatched_checkpoint_is_rejected_before_node_execution():
    saver = InMemorySaver()
    graph = workflow.build_graph(saver)
    config = {"configurable": {"thread_id": "mismatch"}}
    graph.update_state(config, {"text": "original"}, as_node="__start__")
    before = graph.get_state(config)
    with pytest.raises(ValueError):
        workflow.execute_echo("mismatch", "changed", saver)
    after = graph.get_state(config)
    assert after.config == before.config
    assert after.values == before.values


def test_structured_log_keeps_context_without_exception_or_arbitrary_extras():
    record = logging.LogRecord(
        "ai_service.worker", logging.ERROR, __file__, 1, "Workflow failed", (), None
    )
    record.run_id = "run-1"
    record.error_type = "RuntimeError"
    record.api_key = "secret-token"
    record.prompt = "private prompt"
    record.exc_info = (RuntimeError, RuntimeError("password=secret"), None)
    payload = json.loads(JsonFormatter().format(record))
    assert payload["run_id"] == "run-1"
    assert payload["error_type"] == "RuntimeError"
    assert not {"api_key", "prompt", "exc_info"} & payload.keys()
    assert "secret" not in json.dumps(payload)
