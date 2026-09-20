"""PostgreSQL Run, command queue, and event persistence with short transactions."""

from uuid import uuid4

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ai_service.agent_core.contracts import IdempotencyConflict, RunNotFound

PUBLIC_FIELDS = (
    "run_id",
    "workflow",
    "status",
    "input",
    "output",
    "error_code",
    "last_sequence",
    "created_at",
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
            ):
                connection.execute(
                    psycopg.sql.SQL("SELECT 1 FROM {} LIMIT 1").format(
                        psycopg.sql.Identifier(table)
                    )
                )

    def create(
        self, scope: str, key: str, digest: str, workflow: str, payload: dict
    ) -> dict:
        with self.connect() as connection, connection.transaction():
            row = connection.execute(
                """
                INSERT INTO ai_runs (run_id, scope, request_key, request_hash, workflow, input, status)
                VALUES (%s, %s, %s, %s, %s, %s, 'queued')
                ON CONFLICT (scope, request_key) DO NOTHING RETURNING *
            """,
                (uuid4(), scope, key, digest, workflow, Jsonb(payload)),
            ).fetchone()
            if row is None:
                existing = connection.execute(
                    "SELECT * FROM ai_runs WHERE scope = %s AND request_key = %s",
                    (scope, key),
                ).fetchone()
                if existing["request_hash"] != digest:
                    raise IdempotencyConflict()
                return public_view(existing)
            connection.execute(
                "INSERT INTO ai_commands (run_id) VALUES (%s)", (row["run_id"],)
            )
            self._event(connection, row["run_id"], 1, "queued")
            return public_view(row)

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
