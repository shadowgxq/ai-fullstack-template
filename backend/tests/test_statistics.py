"""HTTP/ORM 的统计口径与游标；PostgreSQL 快照另行检查。"""

from datetime import date, datetime, timedelta, timezone

from fastapi import Depends
import pytest
from sqlalchemy import event

from app.api.dependencies import get_statistics_service
from app.core.session import get_db
from app.repositories.statistics_repository import StatisticsRepository
from app.services.statistics_service import StatisticsService
from main import app
import test_garments
import test_wear_history

owner = test_garments.owner


@pytest.fixture
def statistics_clock():
    clock = [datetime(2024, 3, 1, 4, tzinfo=timezone.utc)]

    def configured(db=Depends(get_db)):
        return StatisticsService(
            StatisticsRepository(db), "statistics-test-only", lambda: clock[0]
        )

    app.dependency_overrides[get_statistics_service] = configured
    yield clock
    app.dependency_overrides.pop(get_statistics_service, None)


def get(client, headers, **params):
    return client.get("/api/v1/statistics", headers=headers, params=params)


def test_current_inventory_all_time_counts_and_leap_window(
    client, owner, statistics_clock
):
    _, headers = owner
    first, unavailable, archived = [
        test_wear_history.garment(client, headers, name=f"衣物{i}") for i in range(3)
    ]
    unknown = test_garments.create(
        client, headers, {"name": "未分类"}, "unknown"
    ).json()["data"]["id"]
    for garment_id, status in ((unavailable, "unavailable"), (archived, "archived")):
        assert (
            client.patch(
                f"/api/v1/garments/{garment_id}",
                headers=headers,
                json={"expected_version": 1, "status": status},
            ).status_code
            == 200
        )
    for index, (day, ids) in enumerate(
        (
            ("2024-01-31", [first, archived]),
            ("2024-02-01", [first, first]),
            ("2024-03-01", [unavailable]),
            ("2024-03-01", [first, unavailable]),
        )
    ):
        assert (
            test_wear_history.create(
                client, headers, ids, wear_date=day, key=str(index)
            ).status_code
            == 200
        )
    response = get(client, headers)
    assert response.status_code == 200
    view = response.json()["data"]
    assert (
        view["wardrobe_total"],
        view["archived_count"],
        view["wear_record_count"],
    ) == (3, 1, 4)
    assert (view["wearable_count"], view["unavailable_count"]) == (2, 1)
    assert {item["category"]: item["count"] for item in view["category_counts"]} == {
        None: 1,
        "tops": 2,
    }
    trend = view["trend"]
    assert (trend["start_date"], trend["end_date"], trend["timezone"]) == (
        "2024-02-01",
        "2024-03-01",
        "Asia/Shanghai",
    )
    assert (
        len(trend["days"]) == 30 and sum(item["count"] for item in trend["days"]) == 3
    )
    daily = {item["date"]: item["count"] for item in trend["days"]}
    assert (
        daily["2024-02-01"] == 1
        and daily["2024-02-29"] == 0
        and daily["2024-03-01"] == 2
    )
    usage = {item["garment_id"]: item for item in view["garment_counts"]["items"]}
    assert {key: value["wear_count"] for key, value in usage.items()} == {
        first: 3,
        unavailable: 2,
        archived: 1,
        unknown: 0,
    }
    assert usage[archived]["status"] == "archived"
    assert (
        client.patch(
            f"/api/v1/garments/{first}",
            headers=headers,
            json={"expected_version": 1, "name": "当前名称", "category": "bottoms"},
        ).status_code
        == 200
    )
    changed = get(client, headers).json()["data"]
    assert (
        next(
            item
            for item in changed["garment_counts"]["items"]
            if item["garment_id"] == first
        )["name"]
        == "当前名称"
    )


def test_empty_history_empty_account_and_private_access(
    client, owner, statistics_clock
):
    _, headers = owner
    first = test_wear_history.garment(client, headers)
    view = get(client, headers).json()["data"]
    assert view["wardrobe_total"] == 1 and view["wear_record_count"] == 0
    assert view["garment_counts"]["items"][0]["garment_id"] == first
    assert view["garment_counts"]["items"][0]["wear_count"] == 0
    assert all(item["count"] == 0 for item in view["trend"]["days"])
    other = client.post("/api/v1/auth/wechat", json={"code": "other"}).json()["data"]
    empty = get(client, {"Authorization": f"Bearer {other['access_token']}"}).json()[
        "data"
    ]
    assert (
        empty["wardrobe_total"],
        empty["archived_count"],
        empty["wear_record_count"],
    ) == (0, 0, 0)
    assert empty["category_counts"] == [] and empty["garment_counts"]["items"] == []
    assert client.get("/api/v1/statistics").status_code == 401
    assert get(client, headers, page_size=0).status_code == 422
    assert get(client, headers, page_size=101).status_code == 422


def test_bounded_cursor_order_owner_and_revision_conflicts(
    client, owner, statistics_clock
):
    _, headers = owner
    ids = [
        test_wear_history.garment(client, headers, name=str(index))
        for index in range(3)
    ]
    test_wear_history.create(client, headers, [ids[0]], wear_date="2024-02-28")
    page = get(client, headers, page_size=1).json()["data"]["garment_counts"]
    assert page["items"][0]["garment_id"] == ids[0]
    assert page["next_cursor"]
    second = get(
        client, headers, garment_cursor=page["next_cursor"], page_size=1
    ).json()["data"]["garment_counts"]
    assert second["items"][0]["garment_id"] == max(ids[1:])
    assert second["items"][0]["wear_count"] == 0
    third = get(
        client, headers, garment_cursor=second["next_cursor"], page_size=1
    ).json()["data"]["garment_counts"]
    assert (
        third["items"][0]["garment_id"] == min(ids[1:]) and third["next_cursor"] is None
    )
    assert get(client, headers, garment_cursor="bad").status_code == 422
    assert (
        get(client, headers, garment_cursor=page["next_cursor"] + "tamper").status_code
        == 422
    )
    other = client.post("/api/v1/auth/wechat", json={"code": "other"}).json()["data"]
    assert (
        get(
            client,
            {"Authorization": f"Bearer {other['access_token']}"},
            garment_cursor=page["next_cursor"],
        ).status_code
        == 422
    )
    assert (
        client.patch(
            f"/api/v1/garments/{ids[1]}",
            headers=headers,
            json={"expected_version": 1, "status": "archived"},
        ).status_code
        == 200
    )
    assert get(client, headers, garment_cursor=page["next_cursor"]).status_code == 409
    cursor = get(client, headers, page_size=1).json()["data"]["garment_counts"][
        "next_cursor"
    ]
    record = test_wear_history.create(
        client, headers, [ids[1]], wear_date="2024-02-29", key="new"
    ).json()["data"]
    assert get(client, headers, garment_cursor=cursor).status_code == 409
    cursor = get(client, headers, page_size=1).json()["data"]["garment_counts"][
        "next_cursor"
    ]
    assert (
        client.patch(
            f"/api/v1/wear-records/{record['id']}",
            headers=headers,
            json={"expected_version": 1, "garment_ids": [ids[2]]},
        ).status_code
        == 200
    )
    assert get(client, headers, garment_cursor=cursor).status_code == 409
    cursor = get(client, headers, page_size=1).json()["data"]["garment_counts"][
        "next_cursor"
    ]
    assert (
        client.delete(
            f"/api/v1/wear-records/{record['id']}",
            headers=headers,
            params={"expected_version": 2},
        ).status_code
        == 200
    )
    assert get(client, headers, garment_cursor=cursor).status_code == 409
    restored = get(client, headers).json()["data"]
    assert restored["wear_record_count"] == 1
    assert {
        item["garment_id"]: item["wear_count"]
        for item in restored["garment_counts"]["items"]
    } == {ids[0]: 1, ids[1]: 0, ids[2]: 0}


def test_midnight_cursor_and_cross_month_ranges(client, owner, statistics_clock):
    _, headers = owner
    for _ in range(2):
        test_wear_history.garment(client, headers)
    statistics_clock[0] = datetime(2024, 3, 1, 15, 59, 59, tzinfo=timezone.utc)
    first = get(client, headers, page_size=1).json()["data"]
    statistics_clock[0] += timedelta(seconds=1)
    assert (
        get(
            client, headers, garment_cursor=first["garment_counts"]["next_cursor"]
        ).status_code
        == 409
    )
    trend = get(client, headers).json()["data"]["trend"]
    assert (trend["start_date"], trend["end_date"]) == ("2024-02-02", "2024-03-02")
    for now, expected in (
        (datetime(2024, 3, 29, tzinfo=timezone.utc), date(2024, 2, 29)),
        (datetime(2023, 3, 1, tzinfo=timezone.utc), date(2023, 1, 31)),
    ):
        statistics_clock[0] = now
        trend = get(client, headers).json()["data"]["trend"]
        assert date.fromisoformat(trend["start_date"]) == expected
        assert len(trend["days"]) == 30


def test_single_statement_includes_all_metrics_and_revision(client, db_session, owner):
    owner_id, headers = owner
    test_wear_history.garment(client, headers)
    statements = []

    def track(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", track)
    try:
        view = StatisticsService(StatisticsRepository(db_session), "secret").get(
            owner_id
        )
    finally:
        event.remove(engine, "before_cursor_execute", track)
    assert view.wardrobe_total == 1
    assert (view.wearable_count, view.unavailable_count) == (1, 0)
    assert len(statements) == 1
    assert "account_revisions" in statements[0] and "owned_records" in statements[0]
