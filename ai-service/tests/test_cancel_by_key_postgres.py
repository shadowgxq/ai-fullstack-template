"""Unknown remote identity cancellation must not enqueue new model work."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event

import pytest
from fastapi.testclient import TestClient
from test_postgres import TOKEN
from test_postgres import environment as environment
from test_postgres import owned_database as owned_database
from test_wardrobe import FakeModel
from test_wardrobe_postgres import create, operation
from test_wardrobe_postgres import runtime as runtime
from wardrobe_fixtures import wardrobe_input

from ai_service.api.app import create_app
from ai_service.worker import process_next, worker_connection

pytestmark = pytest.mark.integration


def cancel_by_key(client, key="wardrobe", payload=None):
    return client.post(
        "/api/v1/runs/cancel-by-key",
        headers={"Idempotency-Key": key},
        json={
            "workflow": "wardrobe.recommend.v1",
            "input": payload or wardrobe_input(),
        },
    )


def test_cancel_before_create_is_scoped_durable_tombstone_without_command(runtime):
    config, client, store = runtime
    response = cancel_by_key(client)
    assert response.status_code == 200, response.text
    cancelled = response.json()
    assert cancelled["status"] == "cancelled" and cancelled["cancel_requested"]
    assert cancel_by_key(client).json() == cancelled
    assert create(client) == cancelled
    # A later create using new model settings must still replay the tombstone.
    other_settings = config.model_copy(update={"model_name": "changed-model"})
    with TestClient(create_app(other_settings), headers=client.headers) as updated:
        assert create(updated) == cancelled
    model = FakeModel()
    with worker_connection(store) as conn:
        assert not process_next(config, store, conn, model_port=model)
    assert model.calls == 0
    with store.connect() as conn:
        assert (
            conn.execute("SELECT count(*) AS n FROM ai_commands").fetchone()["n"] == 0
        )
        assert (
            conn.execute("SELECT count(*) AS n FROM ai_operations").fetchone()["n"] == 0
        )
    events = client.get("/api/v1/runs/" + cancelled["run_id"] + "/events").json()
    assert [event["event_type"] for event in events] == ["cancelled"]
    different = wardrobe_input()
    different["scene"] = "work"
    assert cancel_by_key(client, payload=different).status_code == 409
    assert client.get("/api/v1/runs/" + cancelled["run_id"]).json() == cancelled
    with TestClient(
        create_app(config.model_copy(update={"scope": "other-scope"})),
        headers={"Authorization": "Bearer " + TOKEN},
    ) as other:
        other_cancel = cancel_by_key(other)
        assert other_cancel.status_code == 200
        assert other_cancel.json()["run_id"] != cancelled["run_id"]
        assert other.get("/api/v1/runs/" + cancelled["run_id"]).status_code == 404


@pytest.mark.parametrize("phase", ["queued", "running", "completed", "failed"])
def test_cancel_by_key_shares_existing_atomic_terminal_rules(runtime, phase):
    config, client, store = runtime
    queued = create(client)
    with worker_connection(store) as conn:
        model = FakeModel(enabled=phase != "failed")
        if phase == "running":
            assert store.claim_next(conn)["status"] == "running"
        elif phase in {"completed", "failed"}:
            assert process_next(config, store, conn, model_port=model)
        before = client.get("/api/v1/runs/" + queued["run_id"]).json()
        response = cancel_by_key(client)
        assert response.status_code == 200
        actual = response.json()
        if phase in {"completed", "failed"}:
            assert actual == before
        else:
            assert actual["status"] == "cancelled" and actual["output"] is None
        assert cancel_by_key(client).json() == actual
        assert create(client) == actual
        assert not process_next(config, store, conn, model_port=model)
    events = client.get("/api/v1/runs/" + queued["run_id"] + "/events").json()
    assert (
        sum(
            event["event_type"] in {"completed", "failed", "cancelled"}
            for event in events
        )
        == 1
    )
    assert [event["sequence"] for event in events] == list(
        range(1, actual["last_sequence"] + 1)
    )


def test_concurrent_create_and_cancel_by_key_leave_one_cancelled_run_without_work(
    runtime,
):
    config, client, store = runtime
    gate = Barrier(8)

    def command(index):
        gate.wait(timeout=10)
        return cancel_by_key(client).json() if index % 2 else create(client)

    with ThreadPoolExecutor(max_workers=8) as pool:
        replies = list(pool.map(command, range(8)))
    assert len({reply["run_id"] for reply in replies}) == 1
    run_id = replies[0]["run_id"]
    final = client.get("/api/v1/runs/" + run_id).json()
    assert final["status"] == "cancelled"
    with store.connect() as conn:
        assert conn.execute("SELECT count(*) AS n FROM ai_runs").fetchone()["n"] == 1
        assert (
            conn.execute("SELECT count(*) AS n FROM ai_commands").fetchone()["n"] == 0
        )
        assert (
            conn.execute("SELECT count(*) AS n FROM ai_operations").fetchone()["n"] == 0
        )
    model = FakeModel()
    with worker_connection(store) as conn:
        assert not process_next(config, store, conn, model_port=model)
    assert model.calls == 0


def test_cancel_by_key_inflight_preserves_late_evidence_without_publishing(runtime):
    config, client, store = runtime
    queued = create(client)
    entered, release = Event(), Event()
    model = FakeModel()
    original = model.invoke

    def delayed(call):
        entered.set()
        assert release.wait(10)
        return original(call)

    model.invoke = delayed

    def advance():
        with worker_connection(store) as conn:
            return process_next(config, store, conn, model_port=model)

    with ThreadPoolExecutor(max_workers=1) as pool:
        worker = pool.submit(advance)
        try:
            assert entered.wait(10)
            cancelled = cancel_by_key(client)
            assert cancelled.status_code == 200
            assert cancelled.json()["status"] == "cancelled"
        finally:
            release.set()
        assert worker.result(timeout=10)
    final = client.get("/api/v1/runs/" + queued["run_id"]).json()
    assert final["status"] == "cancelled" and final["output"] is None
    assert model.calls == 1
    evidence = operation(store, queued["run_id"])
    assert evidence["state"] == "responded" and evidence["raw_response"]
    assert evidence["send_count"] == 1
