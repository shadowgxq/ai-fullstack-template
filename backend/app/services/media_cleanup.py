"""显式运行私有未引用媒体清理，不启动常驻线程。"""

import argparse
from dataclasses import asdict
import json

from app.core.config import settings
from app.core.session import SessionLocal
from app.repositories.media_repository import MediaRepository
from app.repositories.revision_repository import RevisionRepository
from app.services.media_service import MediaService
from app.services.media_store import MediaStore


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch-size", type=int, default=100)
    args = parser.parse_args()
    with SessionLocal() as db:
        service = MediaService(
            MediaRepository(db),
            RevisionRepository(db),
            MediaStore(
                settings.media_root,
                settings.media_max_bytes,
                settings.media_max_pixels,
                settings.media_max_dimension,
            ),
        )
        result = service.cleanup(batch_size=args.batch_size)
    print(json.dumps(asdict(result)))
    return 1 if result.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
