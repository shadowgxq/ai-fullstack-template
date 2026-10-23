"""Synthetic bounded input for deterministic API/workflow checks, never live inventory."""


def wardrobe_input():
    return {
        "candidates": [
            {
                "id": "11111111-1111-4111-8111-111111111111",
                "name": "测试衣物",
                "category": None,
                "color": None,
                "season": [],
                "occasion": [],
                "tags": [],
            }
        ],
        "preferences": {
            "liked_styles": [],
            "avoided_styles": [],
            "liked_colors": [],
            "avoided_colors": [],
            "liked_occasions": [],
            "avoided_occasions": [],
            "comfort_notes": None,
        },
        "scene": "any",
        "history": {
            "start_date": "2026-09-23",
            "end_date": "2026-10-22",
            "garments": [],
        },
        "weather": {
            "state": "missing",
            "context_id": None,
            "region_id": None,
            "weather_date": "2026-10-22",
            "facts": None,
            "missing_reason": "not_requested",
        },
        "revisions": {
            "inventory_revision": 0,
            "history_revision": 0,
            "preferences_revision": 0,
        },
        "versions": {
            "catalog_version": "1",
            "policy_version": "wardrobe.filter.v1",
            "prompt_version": "wardrobe.recommend.prompt.v1",
            "schema_version": "wardrobe.recommend.output.v1",
        },
        "fact_refs": [],
        "candidate_scope_limited": False,
    }


def choice():
    return {
        "selected_ids": ["11111111-1111-4111-8111-111111111111"],
        "reason_codes": [],
        "fact_refs": [],
        "tradeoff_codes": [
            "partial_outfit",
            "unknown_attributes",
            "weather_missing",
            "history_empty",
        ],
    }
