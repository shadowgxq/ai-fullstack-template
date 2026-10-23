"""Frozen directory identity shared by migration, lookup and cursor validation."""

import hashlib
import json
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parents[1] / "assets/weather/regions.v1.json"
CATALOG = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
MAPPING_VERSION: str = CATALOG["mapping_version"]
DEFAULT_REGION_ID = "cn-101210101"


def verified_rows() -> list[dict]:
    rows = CATALOG["regions"]
    encoded = json.dumps(
        rows, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode()
    if (
        hashlib.sha256(encoded).hexdigest() != CATALOG["data_sha256"]
        or len(rows) != 3216
    ):
        raise ValueError("Frozen region catalog integrity failure")
    return [dict(row, mapping_version=MAPPING_VERSION) for row in rows]
