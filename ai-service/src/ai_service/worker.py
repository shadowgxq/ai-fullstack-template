"""Single Worker, held PostgreSQL session lock, deterministic checkpoint replay."""
import argparse
import logging
import signal
import threading
from contextlib import contextmanager
import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from ai_service.agent_core.contracts import WorkerAlreadyRunning
from ai_service.config import Settings
from ai_service.infrastructure.store import WORKER_LOCK, Store
from ai_service.workflows.echo import execute_echo

logger = logging.getLogger(__name__)

@contextmanager
def worker_connection(store: Store):
    with store.connect() as connection:
        acquired = connection.execute("SELECT pg_try_advisory_lock(%s) AS acquired", (WORKER_LOCK,)).fetchone()
        if not acquired["acquired"]:
            raise WorkerAlreadyRunning("Only one Worker may advance this database")
        # The lock and all application writes share one session. A lost lock
        # connection cannot publish a stale application result.
        yield connection

def process_next(settings: Settings, store: Store, connection) -> bool:
    job = store.claim_next(connection)
    if job is None:
        return False
    run_id = str(job["run_id"])
    try:
        if job["workflow"] != "echo.v1":
            raise ValueError("Unsupported frozen workflow version")
        with PostgresSaver.from_conn_string(settings.database_url) as saver:
            output = execute_echo(run_id, job["input"]["text"], saver)
    except psycopg.Error:
        # Leave the command for restart. No external/paid work exists in this sample.
        raise
    except Exception as exc:
        logger.error("Workflow failed: %s", type(exc).__name__)
        store.finish(connection, run_id, None, error_code="execution_failed")
    else:
        store.finish(connection, run_id, output)
    return True

def run_once(settings: Settings) -> bool:
    store = Store(settings.database_url)
    with worker_connection(store) as connection:
        return process_next(settings, store, connection)

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="Process at most one command, then exit")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    settings = Settings()
    store = Store(settings.database_url)
    stop = threading.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, lambda *_: stop.set())
    with worker_connection(store) as connection:
        while not stop.is_set():
            processed = process_next(settings, store, connection)
            if args.once:
                return
            if not processed:
                stop.wait(settings.poll_interval)

if __name__ == "__main__":
    main()
