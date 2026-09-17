"""Explicit application migrations and separate LangGraph saver setup."""
import hashlib
from importlib.resources import files
import psycopg
from langgraph.checkpoint.postgres import PostgresSaver
from ai_service.config import Settings

def migrate(settings: Settings) -> None:
    with psycopg.connect(settings.database_url) as connection:
        connection.execute("SELECT pg_advisory_xact_lock(76126002)")
        connection.execute("""
            CREATE TABLE IF NOT EXISTS ai_schema_migrations (
                version text PRIMARY KEY, checksum text NOT NULL,
                applied_at timestamptz NOT NULL DEFAULT now()
            )
        """)
        directory = files("ai_service.infrastructure").joinpath("migrations")
        for path in sorted(directory.iterdir(), key=lambda item: item.name):
            if not path.name.endswith(".sql"):
                continue
            sql = path.read_text(encoding="utf-8")
            digest = hashlib.sha256(sql.encode()).hexdigest()
            row = connection.execute(
                "SELECT checksum FROM ai_schema_migrations WHERE version = %s", (path.name,)
            ).fetchone()
            if row:
                if row[0] != digest:
                    raise ValueError(f"Applied migration changed: {path.name}")
                continue
            connection.execute(sql)
            connection.execute(
                "INSERT INTO ai_schema_migrations (version, checksum) VALUES (%s, %s)",
                (path.name, digest),
            )
    with PostgresSaver.from_conn_string(settings.database_url) as saver:
        saver.setup()

if __name__ == "__main__":
    migrate(Settings())
