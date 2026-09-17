"""Real database integration; explicit test DSN required, never an implicit mock."""

import os
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from langgraph.checkpoint.postgres import PostgresSaver

from ai_service.agent_core.contracts import WorkerAlreadyRunning
from ai_service.api.app import create_app
from ai_service.config import Settings
from ai_service.infrastructure.migrate import migrate
from ai_service.infrastructure.store import Store
from ai_service.worker import process_next, worker_connection
from ai_service.workflows.echo import execute_echo

pytestmark = pytest.mark.integration
TOKEN = "test-ai-service-key-not-a-real-secret"


@pytest.fixture
def environment():
    dsn = os.getenv("AI_TEST_DATABASE_URL")
    if not dsn:
        pytest.skip("AI_TEST_DATABASE_URL not set; real PostgreSQL tests not executed")
    if not urlparse(dsn).path.endswith("_test"):
        pytest.fail("Integration database name must end with _test")
    config = Settings(
        _env_file=None, database_url=dsn, api_key=TOKEN, scope=f"test-{uuid4()}"
    )
    migrate(config)
    client = TestClient(
        create_app(config), headers={"Authorization": f"Bearer {TOKEN}"}
    )
    return config, client, Store(dsn)


def create(client, key="one", text="hello"):
    return client.post(
        "/api/v1/runs",
        json={"workflow": "echo.v1", "input": {"text": text}},
        headers={"Idempotency-Key": key},
    )


def test_idempotency_conflict_and_scope_isolation(environment):
    config, client, store = environment
    first = create(client)
    assert first.status_code == 202
    run_id = first.json()["run_id"]
    assert create(client).json()["run_id"] == run_id
    assert create(client, text="different").status_code == 409
    other = TestClient(
        create_app(config.model_copy(update={"scope": f"other-{uuid4()}"})),
        headers=client.headers,
    )
    for suffix in ("", "/result", "/events"):
        assert other.get(f"/api/v1/runs/{run_id}{suffix}").status_code == 404
    assert create(other).json()["run_id"] != run_id
    with worker_connection(store) as connection:
        while process_next(config, store, connection):
            pass


def test_api_queue_worker_result_events_and_immutable_publish(environment):
    config, client, store = environment
    migrate(config)
    assert client.get("/ready").status_code == 200
    run_id = create(client).json()["run_id"]
    base = f"/api/v1/runs/{run_id}"
    assert client.get(base).json()["status"] == "queued"
    assert client.get(base + "/result").status_code == 409
    with worker_connection(store) as connection:
        assert process_next(config, store, connection)
        assert not process_next(config, store, connection)
        store.finish(connection, run_id, {"text": "must-not-overwrite"})
    assert client.get(base + "/result").json() == {"text": "hello"}
    assert [e["event_type"] for e in client.get(base + "/events").json()] == [
        "queued",
        "running",
        "completed",
    ]
    assert [e["sequence"] for e in client.get(base + "/events?after=2").json()] == [3]
    assert client.get(base).json()["last_sequence"] == 3


def test_post_checkpoint_pre_publish_crash_recovery(environment):
    config, client, store = environment
    run_id = create(client, text="resume").json()["run_id"]
    with worker_connection(store) as connection:
        job = store.claim_next(connection)
        assert str(job["run_id"]) == run_id
        with PostgresSaver.from_conn_string(config.database_url) as saver:
            execute_echo(run_id, "resume", saver)
    with worker_connection(store) as connection:
        assert process_next(config, store, connection)
    assert client.get(f"/api/v1/runs/{run_id}/result").json() == {"text": "resume"}
    assert len(client.get(f"/api/v1/runs/{run_id}/events").json()) == 3


def test_second_worker_cannot_advance(environment):
    config, client, store = environment
    with worker_connection(store):
        with pytest.raises(WorkerAlreadyRunning):
            with worker_connection(store):
                pytest.fail("second worker acquired lock")


def test_concurrent_duplicate_creates_one_run(environment):
    config, client, store = environment
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(pool.map(lambda _: create(client), range(4)))
    assert all(r.status_code == 202 for r in responses)
    assert len({r.json()["run_id"] for r in responses}) == 1
    with worker_connection(store) as connection:
        assert process_next(config, store, connection)
        assert not process_next(config, store, connection)
