"""Offline tests for policy, public boundaries and actual in-memory LangGraph."""
from uuid import uuid4
import psycopg
import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.memory import InMemorySaver
from pydantic import ValidationError
from ai_service.agent_core.contracts import request_hash
from ai_service.api.app import create_app
from ai_service.config import Settings
from ai_service.infrastructure.store import Store
from ai_service.workflows.echo import build_graph, execute_echo

TOKEN = "test-ai-service-key-not-a-real-secret"

def settings():
    return Settings(_env_file=None, database_url="postgresql://test:test@localhost:1/ai_runtime_test", api_key=TOKEN)

def test_hash_canonical_and_versioned():
    assert request_hash("v1", {"a": "1", "b": "2"}) == request_hash("v1", {"b": "2", "a": "1"})
    assert request_hash("v1", {"a": "1"}) != request_hash("v2", {"a": "1"})

@pytest.mark.parametrize("kwargs", [{"database_url": "sqlite://"}, {"api_key": "short"}, {"poll_interval": 0}])
def test_invalid_configuration(kwargs):
    values = {"database_url": "postgresql://test:test@localhost/test", "api_key": TOKEN, **kwargs}
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)

def test_health_needs_no_database_and_ready_does(monkeypatch):
    client = TestClient(create_app(settings()))
    assert client.get("/health").json() == {"status": "ok"}
    def unavailable(_self):
        raise psycopg.OperationalError("private connection details")
    monkeypatch.setattr(Store, "ready", unavailable)
    response = client.get("/ready")
    assert response.status_code == 503
    assert "private" not in response.text

@pytest.mark.parametrize("token", [None, "wrong"])
def test_unauthorized_before_database(token):
    client = TestClient(create_app(settings()))
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    assert client.get(f"/api/v1/runs/{uuid4()}", headers=headers).status_code == 401

@pytest.mark.parametrize("body", [
    {"workflow": "arbitrary", "input": {"text": "hi"}},
    {"input": {"text": "hi"}, "scope": "admin"},
    {"input": {"text": 123}},
    {"input": {"text": ""}},
    {"input": {"text": "x" * 2001}},
])
def test_boundary_validation_without_database(body):
    client = TestClient(create_app(settings()))
    response = client.post("/api/v1/runs", json=body, headers={"Authorization": f"Bearer {TOKEN}", "Idempotency-Key": "test"})
    assert response.status_code == 422

def test_graph_checkpoint_reuse_and_mid_graph_resume():
    saver = InMemorySaver()
    assert execute_echo("one", "hello", saver) == {"text": "hello"}
    assert execute_echo("one", "hello", saver) == {"text": "hello"}
    graph = build_graph(saver)
    graph.update_state({"configurable": {"thread_id": "two"}}, {"text": "resume"}, as_node="__start__")
    assert execute_echo("two", "resume", saver) == {"text": "resume"}

def test_completion_gate_rejects_wrong_saved_input():
    saver = InMemorySaver()
    execute_echo("one", "first", saver)
    with pytest.raises(ValueError):
        execute_echo("one", "different", saver)

def test_openapi_auth_and_public_boundary():
    schema = create_app(settings()).openapi()
    assert schema["paths"]["/api/v1/runs"]["post"]["security"] == [{"HTTPBearer": []}]
    fields = schema["components"]["schemas"]["RunView"]["properties"]
    assert "request_hash" not in fields and "scope" not in fields
