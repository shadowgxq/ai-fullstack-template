"""PostgreSQL Run, command queue, and event persistence with short transactions."""

from uuid import UUID, uuid4, uuid5

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ai_service.agent_core.contracts import (
    IdempotencyConflict,
    RunNotFound,
    WorkerAuthorityLost,
)
from ai_service.agent_core.model import ExecutionFailure, ModelReply

PUBLIC_FIELDS = (
    "run_id",
    "workflow",
    "status",
    "input",
    "output",
    "error_code",
    "last_sequence",
    "created_at",
    "cancel_requested",
)
WORKER_LOCK = 76126001


def public_view(row: dict) -> dict:
    return {key: row[key] for key in PUBLIC_FIELDS}


class Store:
    def __init__(self, database_url: str):
        self.database_url = database_url

    def connect(self):
        return psycopg.connect(
            self.database_url, autocommit=True, row_factory=dict_row, connect_timeout=3
        )

    def ready(self) -> None:
        with self.connect() as connection:
            for table in (
                "ai_schema_migrations",
                "ai_runs",
                "ai_commands",
                "ai_events",
                "checkpoints",
                "ai_operations",
            ):
                connection.execute(
                    psycopg.sql.SQL("SELECT 1 FROM {} LIMIT 1").format(
                        psycopg.sql.Identifier(table)
                    )
                )

    def create(
        self,
        scope: str,
        key: str,
        digest: str,
        workflow: str,
        payload: dict,
        execution: dict | None = None,
    ) -> dict:
        return self._create(scope, key, digest, workflow, payload, execution, False)

    def cancel_by_key(
        self,
        scope: str,
        key: str,
        digest: str,
        workflow: str,
        payload: dict,
        execution: dict | None = None,
    ) -> dict:
        # A missing remote mapping must never require enqueueing new paid work.
        return self._create(scope, key, digest, workflow, payload, execution, True)

    def _create(self, scope, key, digest, workflow, payload, execution, cancelled):
        status = "cancelled" if cancelled else "queued"
        with self.connect() as connection, connection.transaction():
            row = connection.execute(
                """
                INSERT INTO ai_runs (run_id, scope, request_key, request_hash, workflow, input,
                    execution_descriptor, status, cancel_requested)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (scope, request_key) DO NOTHING RETURNING *
                """,
                (
                    uuid4(),
                    scope,
                    key,
                    digest,
                    workflow,
                    Jsonb(payload),
                    Jsonb(execution) if execution is not None else None,
                    status,
                    cancelled,
                ),
            ).fetchone()
            if row is None:
                existing = connection.execute(
                    "SELECT * FROM ai_runs WHERE scope = %s AND request_key = %s FOR UPDATE",
                    (scope, key),
                ).fetchone()
                if existing["request_hash"] != digest:
                    raise IdempotencyConflict()
                return (
                    self._cancel_locked(connection, existing)
                    if cancelled
                    else public_view(existing)
                )
            if not cancelled:
                connection.execute(
                    "INSERT INTO ai_commands (run_id) VALUES (%s)", (row["run_id"],)
                )
            self._event(connection, row["run_id"], 1, status)
            return public_view(row)

    def cancel(self, scope: str, run_id: str) -> dict:
        with self.connect() as connection, connection.transaction():
            row = connection.execute(
                "SELECT * FROM ai_runs WHERE scope=%s AND run_id=%s FOR UPDATE",
                (scope, run_id),
            ).fetchone()
            if row is None:
                raise RunNotFound()
            return self._cancel_locked(connection, row)

    def _cancel_locked(self, connection, row):
        if row["status"] in {"completed", "failed", "cancelled"}:
            return public_view(row)
        run_id = row["run_id"]
        sequence = row["last_sequence"]
        if row["status"] == "running":
            sequence += 1
            self._event(connection, run_id, sequence, "cancel_requested")
        sequence += 1
        row = connection.execute(
            "UPDATE ai_runs SET status='cancelled',cancel_requested=true,output=NULL,error_code=NULL,last_sequence=%s WHERE run_id=%s RETURNING *",
            (sequence, run_id),
        ).fetchone()
        self._event(connection, run_id, sequence, "cancelled")
        connection.execute("DELETE FROM ai_commands WHERE run_id=%s", (run_id,))
        return public_view(row)

    @staticmethod
    def assert_authority(connection):
        row = connection.execute(
            "SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND classid=0 AND objid=%s::oid AND objsubid=1 AND granted) AS held",
            (WORKER_LOCK,),
        ).fetchone()
        if not row["held"]:
            raise WorkerAuthorityLost()

    def get(self, scope: str, run_id: str) -> dict:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT * FROM ai_runs WHERE scope = %s AND run_id = %s",
                (scope, run_id),
            ).fetchone()
        if row is None:
            raise RunNotFound()
        return public_view(row)

    def events(self, scope: str, run_id: str, after: int) -> list[dict]:
        self.get(scope, run_id)
        with self.connect() as connection:
            return connection.execute(
                """
                SELECT e.sequence, e.event_type, e.payload FROM ai_events e
                JOIN ai_runs r USING (run_id)
                WHERE r.scope = %s AND r.run_id = %s AND e.sequence > %s
                ORDER BY e.sequence LIMIT 100
            """,
                (scope, run_id, after),
            ).fetchall()

    @staticmethod
    def _event(connection, run_id, sequence: int, status: str) -> None:
        connection.execute(
            """
            INSERT INTO ai_events (run_id, sequence, event_type, payload)
            VALUES (%s, %s, %s, %s)
        """,
            (run_id, sequence, status, Jsonb({"status": status})),
        )

    def claim_next(self, connection) -> dict | None:
        self.assert_authority(connection)
        with connection.transaction():
            row = connection.execute("""
                SELECT r.* FROM ai_runs r JOIN ai_commands c USING (run_id)
                WHERE r.status IN ('queued', 'running')
                ORDER BY c.created_at, r.run_id LIMIT 1 FOR UPDATE OF r
            """).fetchone()
            if row is None:
                return None
            if row["status"] == "queued":
                row = connection.execute(
                    """
                    UPDATE ai_runs SET status = 'running', last_sequence = last_sequence + 1
                    WHERE run_id = %s RETURNING *
                """,
                    (row["run_id"],),
                ).fetchone()
                self._event(connection, row["run_id"], row["last_sequence"], "running")
            return row

    def finish(
        self,
        connection,
        run_id: str,
        output: dict | None,
        error_code: str | None = None,
    ) -> None:
        self.assert_authority(connection)
        status = "failed" if error_code else "completed"
        with connection.transaction():
            row = connection.execute(
                """
                UPDATE ai_runs SET status = %s, output = %s, error_code = %s,
                    last_sequence = last_sequence + 1
                WHERE run_id = %s AND status = 'running' RETURNING last_sequence
            """,
                (
                    status,
                    Jsonb(output) if output is not None else None,
                    error_code,
                    run_id,
                ),
            ).fetchone()
            if row is None:
                return
            self._event(connection, run_id, row["last_sequence"], status)
            connection.execute("DELETE FROM ai_commands WHERE run_id = %s", (run_id,))


class OperationSession:
    """Only the existing Worker session is usable; never obtains another connection."""

    def __init__(self, store: Store, connection):
        self.store, self.connection = store, connection

    def assert_authority(self):
        self.store.assert_authority(self.connection)

    def lookup(self, run_id: str) -> dict | None:
        self.assert_authority()
        return self.connection.execute(
            "SELECT * FROM ai_operations WHERE run_id=%s", (run_id,)
        ).fetchone()

    def begin(self, run_id: str, prepared: dict) -> dict:
        self.assert_authority()
        with self.connection.transaction():
            run = self.connection.execute(
                "SELECT * FROM ai_runs WHERE run_id=%s FOR UPDATE", (run_id,)
            ).fetchone()
            if run is None or run["status"] != "running" or run["cancel_requested"]:
                raise ExecutionFailure("run_cancelled")
            row = self.connection.execute(
                "SELECT * FROM ai_operations WHERE run_id=%s FOR UPDATE", (run_id,)
            ).fetchone()
            keys = ("operation_id", "input_hash", "execution_hash", "request_hash")
            if row is not None:
                if (
                    any(str(row[k]) != prepared[k] for k in keys)
                    or bytes(row["request_body"]) != prepared["request_body"].encode()
                ):
                    raise ExecutionFailure("operation_mismatch")
                if row["state"] == "sending":
                    row = self.connection.execute(
                        "UPDATE ai_operations SET state='unknown',error_code='call_outcome_unknown' WHERE run_id=%s RETURNING *",
                        (run_id,),
                    ).fetchone()
                return row
            return self.connection.execute(
                "INSERT INTO ai_operations(operation_id,run_id,input_hash,execution_hash,request_hash,request_body,state) VALUES (%s,%s,%s,%s,%s,%s,'sending') RETURNING *",
                (
                    prepared["operation_id"],
                    run_id,
                    prepared["input_hash"],
                    prepared["execution_hash"],
                    prepared["request_hash"],
                    prepared["request_body"].encode(),
                ),
            ).fetchone()

    def respond(self, operation_id: str, reply: ModelReply) -> dict:
        self.assert_authority()
        ref = uuid5(UUID(operation_id), "response.v1")
        with self.connection.transaction():
            row = self.connection.execute(
                "UPDATE ai_operations SET state='responded',response_ref=%s,raw_response=%s,output_json=%s,returned_model=%s,provider_request_id=%s,usage=%s,error_code=%s,responded_at=now() WHERE operation_id=%s AND state='sending' RETURNING *",
                (
                    ref,
                    reply.raw_response,
                    Jsonb(reply.output),
                    reply.returned_model,
                    reply.request_id,
                    Jsonb(reply.usage) if reply.usage is not None else None,
                    reply.error_code,
                    operation_id,
                ),
            ).fetchone()
            if row is None:
                raise ExecutionFailure("operation_mismatch")
            return row

    def unknown(self, operation_id: str) -> None:
        self.assert_authority()
        with self.connection.transaction():
            self.connection.execute(
                "UPDATE ai_operations SET state='unknown',error_code='call_outcome_unknown' WHERE operation_id=%s AND state='sending'",
                (operation_id,),
            )

    def load(self, operation_id: str) -> dict:
        self.assert_authority()
        row = self.connection.execute(
            "SELECT * FROM ai_operations WHERE operation_id=%s", (operation_id,)
        ).fetchone()
        if row is None:
            raise ExecutionFailure("operation_mismatch")
        return row
