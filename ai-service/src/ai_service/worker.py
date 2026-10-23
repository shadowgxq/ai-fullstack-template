"""Single Worker, held PostgreSQL session lock, deterministic checkpoint replay."""

import argparse
import logging
import signal
import threading
from collections.abc import Sequence
from contextlib import contextmanager

import psycopg
from langgraph.checkpoint.postgres import PostgresSaver

from ai_service.agent_core.contracts import WorkerAlreadyRunning, WorkerAuthorityLost
from ai_service.agent_core.model import ExecutionFailure
from ai_service.api.schemas import (
    RecommendationChoice,
    RecommendationOutput,
    WardrobeInput,
)
from ai_service.bootstrap import create_runner
from ai_service.config import Settings
from ai_service.infrastructure.execution import request_builder
from ai_service.infrastructure.logging import configure_logging
from ai_service.infrastructure.model_adapter import OpenAIResponsesAdapter
from ai_service.infrastructure.store import WORKER_LOCK, OperationSession, Store
from ai_service.workflows.echo import execute_echo
from ai_service.workflows.wardrobe import execute_wardrobe

logger = logging.getLogger(__name__)


@contextmanager
def worker_connection(store: Store):
    with store.connect() as connection:
        acquired = connection.execute(
            "SELECT pg_try_advisory_lock(%s) AS acquired", (WORKER_LOCK,)
        ).fetchone()
        if not acquired["acquired"]:
            raise WorkerAlreadyRunning("Only one Worker may advance this database")
        # The lock, checkpoints and application writes share one session.
        # Losing that session prevents all stale writes, not just publication.
        yield connection


def process_next(
    settings: Settings, store: Store, connection, *, model_port=None
) -> bool:
    job = store.claim_next(connection)
    if job is None:
        return False
    run_id = str(job["run_id"])
    try:
        # Checkpoint writes must lose authority together with the Worker lock.
        # Using a second connection would allow stale graph writes after lock loss.
        saver = PostgresSaver(connection)
        if model_port is None:
            key = settings.model_api_key
            model_port = OpenAIResponsesAdapter(
                settings.model_enabled,
                key.get_secret_value() if key else None,
                endpoint=settings.model_base_url + "/responses",
            )
        runner = create_runner(
            lambda run_id, text: execute_echo(run_id, text, saver),
            lambda rid, payload: execute_wardrobe(
                rid,
                dict(payload),
                job["execution_descriptor"],
                saver,
                OperationSession(store, connection),
                model_port,
                request_builder,
                lambda value: WardrobeInput.model_validate(value).model_dump(
                    mode="json"
                ),
                lambda value: RecommendationChoice.model_validate(value).model_dump(
                    mode="json"
                ),
                lambda value: RecommendationOutput.model_validate(value).model_dump(
                    mode="json"
                ),
            ),
        )
        output = runner.run(job["workflow"], run_id, job["input"])
    except (psycopg.Error, WorkerAuthorityLost):
        # The next Worker must reconcile the durable Operation; never reconnect here.
        raise
    except Exception as exc:
        logger.error(
            "Workflow failed",
            extra={
                "run_id": run_id,
                "error_type": type(exc).__name__,
                "error_code": exc.code
                if isinstance(exc, ExecutionFailure)
                else "execution_failed",
            },
        )
        store.finish(
            connection,
            run_id,
            None,
            error_code=exc.code
            if isinstance(exc, ExecutionFailure)
            else "execution_failed",
        )
    else:
        store.finish(connection, run_id, output)
    return True


def run_once(settings: Settings) -> bool:
    store = Store(settings.database_url)
    with worker_connection(store) as connection:
        return process_next(settings, store, connection)


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--once", action="store_true", help="Process at most one command, then exit"
    )
    args = parser.parse_args(argv)
    configure_logging()
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
