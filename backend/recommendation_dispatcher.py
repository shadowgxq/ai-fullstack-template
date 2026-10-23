"""Explicit outbox dispatcher; one bounded HTTP attempt per claimed command."""

import argparse

from app.api.dependencies import get_recommendation_service
from app.core.session import SessionLocal


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=1)
    args = parser.parse_args()
    if not 1 <= args.limit <= 100:
        parser.error("--limit must be between 1 and 100")
    with SessionLocal() as db:
        service = get_recommendation_service(db)
        for _ in range(args.limit):
            if not service.dispatch_once():
                break


if __name__ == "__main__":
    main()
