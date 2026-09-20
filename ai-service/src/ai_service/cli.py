"""Explicit package entry points; no command starts a service by default."""

import argparse
import json
import sys
from collections.abc import Sequence


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ai-service")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check", help="Offline package/graph/schema check; no database")
    api = commands.add_parser("api", help="Start the API (migrations remain explicit)")
    api.add_argument("--host", default="127.0.0.1")
    api.add_argument("--port", type=int, default=8001)
    worker = commands.add_parser("worker", help="Start the single PostgreSQL Worker")
    worker.add_argument("--once", action="store_true")
    commands.add_parser(
        "migrate", help="Explicitly apply application and Saver migrations"
    )
    args = parser.parse_args(argv)
    if args.command == "check":
        from ai_service.diagnostics import check_offline

        try:
            result = check_offline()
        except Exception as exc:
            # Diagnostics must not echo credentials or supplier exception messages.
            print(
                json.dumps({"status": "failed", "error_type": type(exc).__name__}),
                file=sys.stderr,
            )
            return 1
        print(json.dumps(result, ensure_ascii=False))
    elif args.command == "api":
        import uvicorn

        if not 1 <= args.port <= 65535:
            parser.error("--port must be between 1 and 65535")
        uvicorn.run(
            "ai_service.api.app:create_app",
            factory=True,
            host=args.host,
            port=args.port,
        )
    elif args.command == "worker":
        from ai_service.worker import main as worker_main

        worker_main(["--once"] if args.once else [])
    else:
        from ai_service.config import Settings
        from ai_service.infrastructure.migrate import migrate

        migrate(Settings())
    return 0
