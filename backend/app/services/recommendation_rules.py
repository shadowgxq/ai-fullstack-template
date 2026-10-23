"""Deterministic candidate policy and evidence-based text; no I/O or inference."""

from datetime import date

from pydantic import JsonValue

from app.models.garment import Garment
from app.services.wardrobe_catalog import COLORS, OCCASIONS, STYLES

CANDIDATE_LIMIT = 16
REASON_CODES = {
    "known_attributes",
    "liked_style",
    "liked_color",
    "liked_occasion",
    "scene_reference",
    "weather_reference",
    "history_reference",
}
TRADEOFF_CODES = {
    "partial_outfit",
    "unknown_attributes",
    "weather_missing",
    "history_empty",
    "comfort_reference_only",
    "candidate_scope_limited",
}


def normalized(value: str | None, catalog: dict[str, str]) -> str | None:
    if value in catalog:
        return value
    return next((key for key, label in catalog.items() if value == label), None)


def styles(garment: Garment) -> set[str]:
    return {value for tag in garment.tags if (value := normalized(tag, STYLES))}


def allowed(garment: Garment, preferences: dict[str, JsonValue]) -> bool:
    for avoided, values, known in (
        (
            preferences["avoided_colors"],
            {normalized(garment.color, COLORS)},
            # multicolor records no components, so it cannot prove absence of
            # any avoided color, including an explicit multicolor avoidance.
            normalized(garment.color, COLORS) not in {None, "multicolor"},
        ),
        (preferences["avoided_styles"], styles(garment), bool(styles(garment))),
        (
            preferences["avoided_occasions"],
            {normalized(item, OCCASIONS) for item in garment.occasion},
            bool(garment.occasion)
            and all(normalized(item, OCCASIONS) for item in garment.occasion),
        ),
    ):
        if avoided and (not known or set(avoided) & values):
            return False
    return garment.status == "wearable"


def ranked(
    garments: list[Garment],
    preferences: dict[str, JsonValue],
    scene: str,
    history: dict[str, dict[str, JsonValue]],
) -> list[Garment]:
    def key(garment):
        matches = len(styles(garment) & set(preferences["liked_styles"]))
        matches += int(normalized(garment.color, COLORS) in preferences["liked_colors"])
        occasions = {normalized(item, OCCASIONS) for item in garment.occasion}
        matches += len(occasions & set(preferences["liked_occasions"]))
        recent = history.get(str(garment.id), {})
        return (
            -matches,
            -int(scene != "any" and scene in occasions),
            recent.get("wear_count", 0),
            recent.get("last_worn_on") or date.min.isoformat(),
            str(garment.id),
        )

    return sorted((item for item in garments if allowed(item, preferences)), key=key)


def candidate(garment: Garment) -> dict[str, JsonValue]:
    return {
        "id": str(garment.id),
        "name": garment.name,
        "category": garment.category,
        "color": garment.color,
        "season": garment.season,
        "occasion": garment.occasion,
        "tags": garment.tags,
    }


def facts(payload: dict[str, JsonValue]) -> list[dict[str, JsonValue]]:
    atoms = []

    def add(kind, field, value, subject=None):
        if value is None or (
            isinstance(value, str) and (not value or len(value) > 200)
        ):
            return
        atoms.append(
            {
                "ref_id": f"fact_{len(atoms)}",
                "kind": kind,
                "subject_id": subject,
                "field": field,
                "value": value,
            }
        )

    # Preference/weather atoms precede optional per-garment details so neither is
    # silently replaced by a long list of tags at the 256-atom boundary.
    for group, field in (
        ("liked_styles", "liked_style"),
        ("liked_colors", "liked_color"),
        ("liked_occasions", "liked_occasion"),
    ):
        for value in payload["preferences"][group]:
            add("preference", field, value)
    weather = payload["weather"]["facts"]
    if weather:
        if weather["observation"]:
            add(
                "weather",
                "observation_temperature_c",
                weather["observation"]["temperature_c"],
            )
        if weather["forecast"]:
            for source, field in (
                ("high_c", "forecast_high_c"),
                ("low_c", "forecast_low_c"),
                ("day_summary", "forecast_day_summary"),
                ("night_summary", "forecast_night_summary"),
            ):
                add("weather", field, weather["forecast"][source])
    summaries = {item["garment_id"]: item for item in payload["history"]["garments"]}
    for item in payload["candidates"]:
        for field in ("name", "category", "color"):
            add("garment", field, item[field], item["id"])
        for value in item["tags"]:
            if style := normalized(value, STYLES):
                add("garment", "style", style, item["id"])
        for value in item["occasion"]:
            if occasion := normalized(value, OCCASIONS):
                add("garment", "occasion", occasion, item["id"])
        summary = summaries[item["id"]]
        add("history", "wear_count", summary["wear_count"], item["id"])
        add("history", "last_worn_on", summary["last_worn_on"], item["id"])
    return atoms[:256]


def explanations(
    payload: dict[str, JsonValue], garments: list[Garment]
) -> tuple[list[str], list[str]]:
    preferences = payload["preferences"]
    history_window = payload["history"]
    history_range = f"{history_window['start_date']} 至 {history_window['end_date']}"
    reasons = []
    if any(
        normalized(item.color, COLORS) in preferences["liked_colors"]
        for item in garments
    ):
        reasons.append("所选衣物包含已记录的偏好颜色。")
    if any(styles(item) & set(preferences["liked_styles"]) for item in garments):
        reasons.append("所选衣物包含明确记录的偏好风格。")
    if any(
        {normalized(value, OCCASIONS) for value in item.occasion}
        & set(preferences["liked_occasions"])
        for item in garments
    ):
        reasons.append("所选衣物包含已记录的偏好场合。")
    if payload["scene"] != "any" and any(
        payload["scene"] in {normalized(value, OCCASIONS) for value in item.occasion}
        for item in garments
    ):
        reasons.append("包含明确记录适合本次场景的衣物。")
    if payload["weather"]["state"] == "available":
        reasons.append("参考所选日期的已知天气信息，不代表衣物保暖或防水保证。")
    if any(item["wear_count"] for item in payload["history"]["garments"]):
        reasons.append(
            f"本次参考区间（{history_range}）已有所选衣物的穿着记录，供重复搭配参考。"
        )
    if not reasons and garments:
        reasons.append("仅从满足当前条件的本人衣物中选择。")
    limitations = ["仅涵盖所选衣物，不保证完整搭配。"] if garments else []
    if any(
        not item.category or not item.color or not styles(item) for item in garments
    ):
        limitations.append("部分衣物属性未记录，相关判断缺少依据。")
    if preferences["comfort_notes"]:
        limitations.append("舒适度描述仅供 AI 参考，不保证满足。")
    if payload["weather"]["state"] == "missing":
        limitations.append("天气信息缺失，未据此判断天气适配。")
    if not any(item["wear_count"] for item in payload["history"]["garments"]):
        limitations.append(f"本次参考区间（{history_range}）暂无相关衣物的已记录穿着。")
    if payload["candidate_scope_limited"]:
        limitations.append("已检查全部库存，本次 AI 输入仅含排序后的前16件合规衣物。")
    return reasons, limitations


def validate_output(
    payload: dict[str, JsonValue], output: dict[str, JsonValue]
) -> list[str]:
    if not isinstance(output, dict) or set(output) != {
        "selected_ids",
        "reason_codes",
        "fact_refs",
        "tradeoff_codes",
        "call_evidence",
    }:
        raise ValueError("Invalid output shape")
    for field, maximum in (
        ("selected_ids", 64),
        ("reason_codes", 32),
        ("fact_refs", 128),
        ("tradeoff_codes", 32),
    ):
        values = output[field]
        if (
            not isinstance(values, list)
            or len(values) > maximum
            or any(not isinstance(value, str) for value in values)
            or len(set(values)) != len(values)
        ):
            raise ValueError("Invalid output members")
    selected = set(output["selected_ids"])
    if not selected or not selected <= {item["id"] for item in payload["candidates"]}:
        raise ValueError("Invalid selection")
    if (
        not set(output["reason_codes"]) <= REASON_CODES
        or not set(output["tradeoff_codes"]) <= TRADEOFF_CODES
    ):
        raise ValueError("Invalid codes")
    atoms = {item["ref_id"]: item for item in payload["fact_refs"]}
    if any(
        ref not in atoms
        or (
            atoms[ref]["subject_id"] is not None
            and atoms[ref]["subject_id"] not in selected
        )
        for ref in output["fact_refs"]
    ):
        raise ValueError("Invalid facts")
    used = [atoms[ref] for ref in output["fact_refs"]]
    for code in output["reason_codes"]:
        if code in {"liked_color", "liked_style", "liked_occasion"}:
            field = code.removeprefix("liked_")
            if not any(
                g["kind"] == "garment"
                and g["field"] == field
                and any(
                    p["kind"] == "preference"
                    and p["field"] == code
                    and p["value"]
                    == (
                        normalized(g["value"], COLORS)
                        if field == "color"
                        else g["value"]
                    )
                    for p in used
                )
                for g in used
            ):
                raise ValueError("Unsubstantiated preference")
        elif code == "weather_reference":
            if payload["weather"]["state"] != "available" or not any(
                atom["kind"] == "weather" for atom in used
            ):
                raise ValueError("Unsubstantiated weather")
        elif code == "history_reference":
            if not any(
                atom["kind"] == "history"
                and (
                    (atom["field"] == "wear_count" and atom["value"] > 0)
                    or atom["field"] == "last_worn_on"
                )
                for atom in used
            ):
                raise ValueError("Unsubstantiated history")
        elif code == "scene_reference":
            if payload["scene"] == "any" or not any(
                atom["kind"] == "garment"
                and atom["field"] == "occasion"
                and atom["value"] == payload["scene"]
                for atom in used
            ):
                raise ValueError("Unsubstantiated scene")
        elif not any(atom["kind"] == "garment" for atom in used):
            raise ValueError("Unsubstantiated attributes")
    return output["selected_ids"]
