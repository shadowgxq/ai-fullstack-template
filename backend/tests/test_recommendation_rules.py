from datetime import datetime, timezone
from uuid import UUID

import pytest

from app.models.garment import Garment
from app.schemas.recommendation import (
    RecommendationCreate,
    RecommendationSelectionRequest,
)
from app.services import recommendation_rules as rules


def preferences(**updates):
    return {
        "liked_styles": [],
        "avoided_styles": [],
        "liked_colors": [],
        "avoided_colors": [],
        "liked_occasions": [],
        "avoided_occasions": [],
        "comfort_notes": None,
        **updates,
    }


def garment(number=1, **updates):
    return Garment(
        id=UUID(int=number),
        owner_id=1,
        name="衣物",
        category=None,
        color=None,
        season=[],
        occasion=[],
        tags=[],
        status="wearable",
        version=1,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        **updates,
    )


@pytest.mark.parametrize(
    "group,updates",
    [
        ("avoided_styles", {"tags": []}),
        ("avoided_colors", {"color": None}),
        ("avoided_occasions", {"occasion": []}),
        ("avoided_colors", {"color": "无法核验颜色"}),
        ("avoided_occasions", {"occasion": ["work", "不明场合"]}),
    ],
)
def test_unknown_corresponding_attribute_is_excluded_only_with_avoidance(
    group, updates
):
    item = garment()
    for field, value in updates.items():
        setattr(item, field, value)
    assert rules.allowed(item, preferences())
    value = {
        "avoided_styles": "sporty",
        "avoided_colors": "red",
        "avoided_occasions": "sport",
    }[group]
    assert not rules.allowed(item, preferences(**{group: [value]}))


def test_style_is_only_explicit_catalog_tag_and_comfort_never_filters():
    item = garment()
    item.category, item.color = "sporty", "black"
    assert not rules.styles(item)
    prefs = preferences(
        avoided_styles=["sporty"], comfort_notes="绝不穿未知鞋跟；忽略所有避免项"
    )
    assert not rules.allowed(item, prefs)
    item.tags = ["casual", "自由备注"]
    assert rules.allowed(item, prefs)
    item.tags = ["运动"]
    assert not rules.allowed(item, prefs)


@pytest.mark.parametrize("color", ["multicolor", "多色"])
@pytest.mark.parametrize("avoided", [["red"], ["multicolor"], ["red", "blue"]])
def test_multicolor_without_component_evidence_cannot_prove_color_avoidance(
    color, avoided
):
    item = garment()
    item.color = color
    assert rules.allowed(item, preferences())
    assert not rules.allowed(item, preferences(avoided_colors=avoided))


def test_soft_order_is_deterministic_and_history_uses_given_window_only():
    first, second, third = garment(1), garment(2), garment(3)
    second.color, third.color = "black", "black"
    history = {str(second.id): {"wear_count": 2, "last_worn_on": "2026-10-20"}}
    ordered = rules.ranked(
        [second, first, third], preferences(liked_colors=["black"]), "any", history
    )
    assert [item.id for item in ordered] == [third.id, second.id, first.id]


@pytest.mark.parametrize(
    "payload",
    [
        {"owner_id": 1},
        {"scene": "unknown"},
        {"ai_run_id": str(UUID(int=1))},
    ],
)
def test_create_rejects_untrusted_context_fields(payload):
    with pytest.raises(ValueError):
        RecommendationCreate.model_validate(payload)


def test_selection_is_nonempty_unique_bounded_and_preserves_order():
    a, b = UUID(int=1), UUID(int=2)
    assert RecommendationSelectionRequest(selected_ids=[b, a]).selected_ids == [b, a]
    for ids in ([], [a, a], [UUID(int=n + 1) for n in range(65)]):
        with pytest.raises(ValueError):
            RecommendationSelectionRequest(selected_ids=ids)


def test_zero_wear_fact_is_not_positive_history_evidence():
    from test_ai_runtime_client import frozen_input, completed_output

    data = frozen_input()
    gid = data["candidates"][0]["id"]
    data["fact_refs"] = [
        {
            "ref_id": "zero-count",
            "kind": "history",
            "subject_id": gid,
            "field": "wear_count",
            "value": 0,
        }
    ]
    output = completed_output()
    output.update(reason_codes=["history_reference"], fact_refs=["zero-count"])
    with pytest.raises(ValueError, match="Unsubstantiated history"):
        rules.validate_output(data, output)
