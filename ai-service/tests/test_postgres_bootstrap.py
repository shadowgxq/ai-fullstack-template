"""New bootstrap paths must also work with real PostgreSQL and a separate CLI process."""

import os
import subprocess
import sys
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from test_postgres import TOKEN, create
from test_postgres import environment as environment

from ai_service.api.app import create_app
from ai_service.worker import process_next, worker_connection

pytestmark = pytest.mark.integration


def test_cli_worker_runs_from_a_different_directory(environment, tmp_path):
    config, client, store = environment
    run_id = create(client, key=str(uuid4()), text="cli-process").json()["run_id"]
    env = {
        **os.environ,
        "AI_DATABASE_URL": config.database_url,
        "AI_API_KEY": TOKEN,
        "AI_SCOPE": config.scope,
    }
    env.pop("PYTHONPATH", None)
    process = subprocess.run(
        [sys.executable, "-m", "ai_service", "worker", "--once"],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert process.returncode == 0
    assert client.get(f"/api/v1/runs/{run_id}/result").json() == {"text": "cli-process"}
    other = TestClient(
        create_app(config.model_copy(update={"scope": "not-the-owner"})),
        headers=client.headers,
    )
    assert other.get(f"/api/v1/runs/{run_id}/result").status_code == 404


def test_unregistered_persisted_version_fails_without_a_result(environment):
    config, client, store = environment
    run_id = create(client, key=str(uuid4())).json()["run_id"]
    with store.connect() as connection:
        connection.execute(
            "UPDATE ai_runs SET workflow = %s WHERE run_id = %s",
            ("echo.removed", run_id),
        )
    with worker_connection(store) as connection:
        assert process_next(config, store, connection)
    snapshot = client.get(f"/api/v1/runs/{run_id}").json()
    assert snapshot["status"] == "failed"
    assert snapshot["output"] is None
    assert snapshot["error_code"] == "execution_failed"
    assert client.get(f"/api/v1/runs/{run_id}/result").status_code == 409
