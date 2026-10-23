"""从冻结官方字面量生成唯一一致地区；不执行 JS，也不访问网络。"""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re


def literal_assignment(source: str, variable: str) -> object:
    match = re.fullmatch(
        r"\s*var\s+" + re.escape(variable) + r"\s*=\s*([\s\S]+?)\s*;?\s*", source
    )
    if match is None:
        raise ValueError("Unexpected assignment")
    data = match[1]
    position = 0
    decoder = json.JSONDecoder()

    def whitespace():
        nonlocal position
        while position < len(data) and data[position].isspace():
            position += 1

    def take(token):
        nonlocal position
        whitespace()
        if not data.startswith(token, position):
            raise ValueError("Unexpected literal token")
        position += len(token)

    def value(depth=0):
        nonlocal position
        if depth > 8:
            raise ValueError("Literal nesting limit exceeded")
        whitespace()
        if position >= len(data):
            raise ValueError("Incomplete literal")
        if data[position] == '"':
            result, position = decoder.raw_decode(data, position)
            if not isinstance(result, str):
                raise ValueError("Only string values are supported")
            return result
        if data[position] == "[":
            take("[")
            result = []
            whitespace()
            if data.startswith("]", position):
                take("]")
                return result
            while True:
                result.append(value(depth + 1))
                whitespace()
                if data.startswith("]", position):
                    take("]")
                    return result
                take(",")
        if data[position] == "{":
            take("{")
            result = {}
            whitespace()
            if data.startswith("}", position):
                take("}")
                return result
            while True:
                whitespace()
                if data.startswith('"', position):
                    key, position = decoder.raw_decode(data, position)
                else:
                    identifier = re.match(r"[A-Za-z_][A-Za-z0-9_]*", data[position:])
                    if identifier is None:
                        raise ValueError("Invalid literal key")
                    key = identifier[0]
                    position += len(key)
                if key in result:
                    raise ValueError("Duplicate literal key")
                take(":")
                result[key] = value(depth + 1)
                whitespace()
                if data.startswith("}", position):
                    take("}")
                    return result
                take(",")
        raise ValueError("Executable or unsupported value")

    result = value()
    whitespace()
    if position != len(data):
        raise ValueError("Trailing executable content")
    return result


def freeze(sources: Path) -> dict:
    mobile_path, pc_path = sources / "mobile-city-data.raw", sources / "pc-city.raw"
    mobile = literal_assignment(mobile_path.read_text(), "citySearchSource")
    hierarchy = literal_assignment(pc_path.read_text(), "city_data")
    mobile_counts = Counter(row["ac"] for row in mobile)
    pc_rows = []
    for province, cities in hierarchy.items():
        for city, districts in cities.items():
            for district, row in districts.items():
                pc_rows.append(
                    {"province": province, "city": city, "district": district, **row}
                )
    pc_counts = Counter(row["AREAID"] for row in pc_rows)
    indexed = {row["AREAID"]: row for row in pc_rows}
    rows = []
    for entry in mobile:
        code = entry["ac"]
        pc = indexed.get(code)
        if (
            not re.fullmatch(r"101\d{6}", code)
            or mobile_counts[code] != 1
            or pc_counts[code] != 1
            or pc is None
            or entry["n"] != pc["NAMECN"]
            or entry["pv"] != pc["province"]
            or not all(pc[key] for key in ("province", "city", "district"))
        ):
            continue
        display = " / ".join(pc[key] for key in ("province", "city", "district"))
        aliases = sorted(
            {
                entry["n"],
                entry["p"].casefold(),
                display,
                "".join(pc[key] for key in ("province", "city", "district")),
            }
        )
        rows.append(
            {
                "region_id": "cn-" + code,
                "weather_code": code,
                "province": pc["province"],
                "city": pc["city"],
                "district": pc["district"],
                "display_name": display,
                "aliases": aliases,
                "search_text": "\n".join(
                    "".join(alias.casefold().split()) for alias in aliases
                ),
            }
        )
    rows.sort(key=lambda row: row["region_id"])
    encoded = json.dumps(
        rows, sort_keys=True, ensure_ascii=False, separators=(",", ":")
    ).encode()
    digest = hashlib.sha256(encoded).hexdigest()
    metadata = []
    for label, path in (("mobile-city-data", mobile_path), ("pc-city", pc_path)):
        meta = json.loads((sources / (label + ".meta.json")).read_text())
        if hashlib.sha256(path.read_bytes()).hexdigest() != meta["sha256"]:
            raise ValueError("Source hash mismatch")
        metadata.append(meta)
    return {
        "mapping_version": "weather-cn-v1-" + digest[:16],
        "data_sha256": digest,
        "sources": metadata,
        "regions": rows,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(freeze(args.sources), ensure_ascii=False, sort_keys=True, indent=2)
        + "\n"
    )
