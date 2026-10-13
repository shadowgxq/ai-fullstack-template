"""Bookmark transport/normalization and observable lifecycle on isolated SQLite."""

from uuid import uuid4

import pytest

from app.api.dependencies import get_current_user
from app.models.bookmark import BookmarkGroup
from app.models.user import User
from main import app


@pytest.fixture
def owner(client, db_session):
    user = User(username="bookmark-owner", password_hash="unused")
    other = User(username="bookmark-other", password_hash="unused")
    db_session.add_all([user, other])
    db_session.commit()
    user_id, other_id = user.id, other.id
    identity = {"id": user_id}
    app.dependency_overrides[get_current_user] = lambda: User(
        id=identity["id"], username="fixture", password_hash=""
    )
    yield identity, user_id, other_id
    app.dependency_overrides.pop(get_current_user, None)


def write(client, payload=None, *, key=None, method="post", path="/api/v1/bookmarks"):
    return getattr(client, method)(
        path,
        headers={"Idempotency-Key": str(key or uuid4())},
        **({"json": payload} if payload is not None else {}),
    )


def payload(**changes):
    return {
        "title": "订阅资料",
        "url": "https://example.com/billing?q=A#part",
        "note": "备注",
        **changes,
    }


def test_private_lifecycle_duplicate_urls_and_receipt_survives_delete(client, owner):
    identity, user_id, other_id = owner
    key = uuid4()
    created = write(client, payload(title="  订阅资料  "), key=key)
    assert created.status_code == 200
    receipt = created.json()["data"]
    bookmark_id = receipt["resource_id"]
    assert receipt["kind"] == "bookmark_create" and receipt["changed_count"] == 1
    assert write(client, payload(), key=key).json()["data"] == receipt
    assert write(client, payload()).status_code == 200  # Duplicate URLs are valid.
    rows = client.get("/api/v1/bookmarks").json()["data"]
    assert rows["total"] == rows["all_count"] == rows["ungrouped_count"] == 2
    assert rows["groups"] == [] and rows["page_size"] == 10
    before = client.get(f"/api/v1/bookmarks/{bookmark_id}").json()["data"]
    assert before["title"] == "订阅资料" and before["note"] == "备注"
    assert before["updated_at"].endswith("Z") or "+00:00" in before["updated_at"]
    assert write(client, payload(title="另一个意图"), key=key).json()["code"] == 40911

    identity["id"] = other_id
    assert client.get("/api/v1/bookmarks").json()["data"]["total"] == 0
    for method in ("get", "put", "delete"):
        response = (
            client.get(f"/api/v1/bookmarks/{bookmark_id}")
            if method == "get"
            else write(
                client,
                payload() if method == "put" else None,
                method=method,
                path=f"/api/v1/bookmarks/{bookmark_id}",
            )
        )
        assert response.status_code == 404 and response.json()["code"] == 40410

    identity["id"] = user_id
    assert (
        write(
            client,
            payload(title="更新资料", note=""),
            method="put",
            path=f"/api/v1/bookmarks/{bookmark_id}",
        ).status_code
        == 200
    )
    assert (
        client.get(f"/api/v1/bookmarks/{bookmark_id}").json()["data"]["title"]
        == "更新资料"
    )
    assert (
        write(
            client, method="delete", path=f"/api/v1/bookmarks/{bookmark_id}"
        ).status_code
        == 200
    )
    assert client.get(f"/api/v1/bookmarks/{bookmark_id}").status_code == 404
    resolved = client.post(f"/api/v1/bookmark-operations/{key}/resolve").json()["data"]
    assert resolved["status"] == "succeeded" and resolved["resource_id"] == bookmark_id
    assert write(client, payload(), key=key).json()["data"] == receipt
    assert client.get("/api/v1/bookmarks").json()["data"]["total"] == 1


@pytest.mark.parametrize(
    "changes,field",
    [
        ({"title": " "}, "title"),
        ({"title": "😀" * 81}, "title"),
        ({"note": "😀" * 501}, "note"),
        ({"url": "https://example.com/" + "a" * 2048}, "url"),
        ({"url": "stripe.com/billing"}, "url"),
        ({"url": "javascript:alert(1)"}, "url"),
        ({"url": "https:///missing-host"}, "url"),
        ({"url": "https://bad_host.test"}, "url"),
        ({"url": "https://example.com/a\nb"}, "url"),
        ({"url": "https://example.com:invalid"}, "url"),
        ({"title": 12}, "title"),
        ({"owner": 123}, "owner"),
    ],
)
def test_validation_is_field_scoped_without_input_disclosure(
    client, owner, changes, field
):
    response = write(client, payload(**changes))
    assert response.status_code == 422
    issues = response.json()["data"]
    assert any(field in issue["loc"] for issue in issues)
    assert all(set(issue) == {"loc", "type", "msg"} for issue in issues)
    assert client.get("/api/v1/bookmarks").json()["data"]["total"] == 0


def test_code_point_limits_url_preservation_and_strict_header(client, owner):
    url = "https://example.com/" + "x" * (2048 - len("https://example.com/"))
    assert (
        write(
            client, payload(title="😀" * 80, note="😀" * 500, url=f" {url} ")
        ).status_code
        == 200
    )
    row = client.get("/api/v1/bookmarks").json()["data"]["list"][0]
    assert len(row["title"]) == 80 and len(row["note"]) == 500 and row["url"] == url
    assert client.post("/api/v1/bookmarks", json=payload()).status_code == 422
    assert (
        client.post(
            "/api/v1/bookmarks", headers={"Idempotency-Key": "wrong"}, json=payload()
        ).status_code
        == 422
    )
    assert client.get("/api/v1/bookmarks?page=0").status_code == 422
    assert client.get("/api/v1/bookmarks?group=bad").status_code == 422


@pytest.mark.parametrize(
    "host",
    [
        "256.0.0.1",
        "999.999.999.999",
        "1.2.3.256",
        "4294967296",
        "0x100000000",
        "127.16777216",
        "09",
        "example.1",
        "1.2.3.4.5",
    ],
)
def test_invalid_numeric_url_host_is_rejected_without_saving(client, owner, host):
    response = write(client, payload(url=f"http://{host}/path"))
    assert response.status_code == 422
    assert any("url" in issue["loc"] for issue in response.json()["data"])
    assert client.get("/api/v1/bookmarks").json()["data"]["total"] == 0


@pytest.mark.parametrize(
    "host",
    [
        "0.0.0.0",
        "255.255.255.255",
        "127.0.0.1",
        "127.0.0.1.",
        "0xffffffff",
        "2130706433",
        "127.1",
        "0177.0.0.1",
        "0x7f.1",
        "0x",
        "[::1]",
        "[::ffff:192.0.2.128]",
        "123.example.com",
        "example.0xz",
    ],
)
def test_valid_ip_and_domain_hosts_keep_original_url(client, owner, host):
    url = f"https://{host}/path?q=A#fragment"
    response = write(client, payload(url=url))
    assert response.status_code == 200
    bookmark_id = response.json()["data"]["resource_id"]
    assert client.get(f"/api/v1/bookmarks/{bookmark_id}").json()["data"]["url"] == url


@pytest.mark.parametrize("method", ["post", "put"])
@pytest.mark.parametrize("field", ["title", "note"])
def test_nul_is_a_field_error_without_mutation_or_input_disclosure(
    client, owner, method, field
):
    path = "/api/v1/bookmarks"
    before = None
    if method == "put":
        created = write(client, payload()).json()["data"]
        path += f"/{created['resource_id']}"
        before = client.get(path).json()["data"]
    response = write(
        client, payload(**{field: "private\x00draft"}), method=method, path=path
    )
    assert response.status_code == 422 and response.json()["code"] == 42200
    issues = response.json()["data"]
    assert any(issue["loc"] == ["body", field] for issue in issues)
    assert all(set(issue) == {"loc", "type", "msg"} for issue in issues)
    assert "private" not in response.text and "draft" not in response.text
    if method == "put":
        assert client.get(path).json()["data"] == before
    else:
        assert client.get("/api/v1/bookmarks").json()["data"]["total"] == 0


def test_non_nul_text_is_preserved_without_new_character_stripping(client, owner):
    title = "前缀\t中间\n😀"
    note = "  备注\r\n\t😀\x01  "
    receipt = write(client, payload(title=title, note=note)).json()["data"]
    row = client.get(f"/api/v1/bookmarks/{receipt['resource_id']}").json()["data"]
    assert row["title"] == title and row["note"] == note


def test_group_and_literal_search_pagination_snapshot(client, db_session, owner):
    _, user_id, other_id = owner
    group = BookmarkGroup(user_id=user_id, name="研究", name_key="研究")
    empty = BookmarkGroup(user_id=user_id, name="空分组", name_key="空分组")
    foreign = BookmarkGroup(user_id=other_id, name="他人的", name_key="他人的")
    db_session.add_all([group, empty, foreign])
    db_session.commit()
    group_id, empty_id, foreign_id = group.id, empty.id, foreign.id
    for index in range(12):
        assert (
            write(
                client,
                payload(
                    title=f"Title {index}", group_id=str(group_id), note="SECRET needle"
                ),
            ).status_code
            == 200
        )
    assert (
        write(
            client, payload(title="100%_\\ 中文😀 A", url="https://EXAMPLE.com/Needle")
        ).status_code
        == 200
    )
    failed_key = uuid4()
    assert (
        write(client, payload(group_id=str(foreign_id)), key=failed_key).status_code
        == 404
    )
    assert (
        client.post(f"/api/v1/bookmark-operations/{failed_key}/resolve").json()["data"][
            "status"
        ]
        == "failed"
    )
    assert (
        write(client, payload(group_id=str(foreign_id)), key=failed_key).status_code
        == 404
    )
    assert write(client, payload(), key=failed_key).json()["code"] == 40911
    for query, expected in (
        (" tItLe ", 12),
        ("%_\\", 1),
        ("needle", 1),
        ("SECRET", 0),
        ("中文😀", 1),
    ):
        result = client.get(
            "/api/v1/bookmarks", params={"q": query, "page": 999}
        ).json()["data"]
        assert result["total"] == expected
        assert result["page"] == (2 if expected == 12 else 1)
        assert result["all_count"] == 13 and result["ungrouped_count"] == 1
        assert {row["id"]: row["count"] for row in result["groups"]} == {
            str(group_id): 12,
            str(empty_id): 0,
        }
    assert (
        client.get(
            "/api/v1/bookmarks", params={"group": str(group_id), "q": "needle"}
        ).json()["data"]["total"]
        == 0
    )
    assert (
        client.get("/api/v1/bookmarks", params={"group": str(foreign_id)}).status_code
        == 404
    )
    page = client.get(
        "/api/v1/bookmarks", params={"group": str(group_id), "page": 2}
    ).json()["data"]
    assert len(page["list"]) == 2
    for row in page["list"]:
        assert (
            write(
                client, method="delete", path=f"/api/v1/bookmarks/{row['id']}"
            ).status_code
            == 200
        )
    result = client.get(
        "/api/v1/bookmarks", params={"group": str(group_id), "page": 2}
    ).json()["data"]
    assert result["page"] == 1 and result["total"] == 10 and len(result["list"]) == 10
    assert db_session.get(BookmarkGroup, group_id) is not None


def test_resolve_fences_late_requests_and_is_private(client, owner):
    identity, user_id, other_id = owner
    key = uuid4()
    first = client.post(f"/api/v1/bookmark-operations/{key}/resolve").json()["data"]
    assert first == {
        "operation_id": str(key),
        "kind": None,
        "status": "not_executed",
        "resource_id": None,
        "changed_count": 0,
        "error_code": None,
    }
    assert (
        client.post(f"/api/v1/bookmark-operations/{key}/resolve").json()["data"]
        == first
    )
    assert write(client, payload(), key=key).json()["code"] == 40913
    identity["id"] = other_id
    assert write(client, payload(), key=key).status_code == 200
    identity["id"] = user_id
    assert client.get("/api/v1/bookmarks").json()["data"]["total"] == 0


def test_group_lifecycle_counts_rename_order_delete_and_recovery(client, owner):
    identity, user_id, other_id = owner
    create_key = uuid4()
    created = write(
        client, {"name": "  Tools  "}, path="/api/v1/bookmark-groups", key=create_key
    )
    assert created.status_code == 200
    create_receipt = created.json()["data"]
    group_id = create_receipt["resource_id"]
    group_path = f"/api/v1/bookmark-groups/{group_id}"
    assert (
        create_receipt["kind"] == "group_create"
        and create_receipt["changed_count"] == 1
    )
    assert (
        write(
            client, {"name": "Tools"}, path="/api/v1/bookmark-groups", key=create_key
        ).json()["data"]
        == create_receipt
    )
    empty = client.get("/api/v1/bookmarks").json()["data"]
    assert empty["groups"] == [{"id": group_id, "name": "Tools", "count": 0}]
    for index in range(3):
        assert (
            write(client, payload(title=f"资料 {index}", group_id=group_id)).status_code
            == 200
        )
    before = client.get("/api/v1/bookmarks", params={"group": group_id}).json()["data"]
    assert before["total"] == 3 and before["groups"][0]["count"] == 3
    renamed = write(client, {"name": "Tooling"}, method="patch", path=group_path)
    assert (
        renamed.status_code == 200 and renamed.json()["data"]["kind"] == "group_rename"
    )
    after = client.get(
        "/api/v1/bookmarks", params={"group": group_id, "q": "资料 1"}
    ).json()["data"]
    assert after["total"] == 1 and after["groups"][0] == {
        "id": group_id,
        "name": "Tooling",
        "count": 3,
    }
    assert (
        client.get("/api/v1/bookmarks", params={"group": group_id}).json()["data"][
            "list"
        ]
        == before["list"]
    )
    duplicate_key = uuid4()
    assert (
        write(
            client,
            {"name": "tOoLiNg"},
            path="/api/v1/bookmark-groups",
            key=duplicate_key,
        ).json()["code"]
        == 40910
    )
    failed = client.post(f"/api/v1/bookmark-operations/{duplicate_key}/resolve").json()[
        "data"
    ]
    assert failed["status"] == "failed" and failed["error_code"] == 40910
    assert (
        write(
            client,
            {"name": "tOoLiNg"},
            path="/api/v1/bookmark-groups",
            key=duplicate_key,
        ).json()["code"]
        == 40910
    )
    identity["id"] = other_id
    assert (
        write(client, {"name": "Tooling"}, path="/api/v1/bookmark-groups").status_code
        == 200
    )
    assert (
        write(client, {"name": "mine"}, method="patch", path=group_path).status_code
        == 404
    )
    assert (
        write(
            client, method="delete", path=group_path + "?expected_count=3"
        ).status_code
        == 404
    )
    identity["id"] = user_id
    impact_key = uuid4()
    assert (
        write(
            client,
            method="delete",
            path=group_path + "?expected_count=2",
            key=impact_key,
        ).json()["code"]
        == 40912
    )
    impact = client.post(f"/api/v1/bookmark-operations/{impact_key}/resolve").json()[
        "data"
    ]
    assert impact["status"] == "failed" and impact["error_code"] == 40912
    assert (
        client.get("/api/v1/bookmarks", params={"group": group_id}).json()["data"][
            "list"
        ]
        == before["list"]
    )
    assert (
        write(
            client,
            method="delete",
            path=group_path + "?expected_count=3",
            key=impact_key,
        ).json()["code"]
        == 40911
    )
    delete_key = uuid4()
    removed = write(
        client, method="delete", path=group_path + "?expected_count=3", key=delete_key
    )
    assert removed.status_code == 200
    delete_receipt = removed.json()["data"]
    assert (
        delete_receipt["kind"] == "group_delete"
        and delete_receipt["changed_count"] == 3
    )
    assert (
        write(
            client,
            method="delete",
            path=group_path + "?expected_count=3",
            key=delete_key,
        ).json()["data"]
        == delete_receipt
    )
    result = client.get(
        "/api/v1/bookmarks", params={"group": "ungrouped", "page": 999}
    ).json()["data"]
    assert result["total"] == result["all_count"] == result["ungrouped_count"] == 3
    assert result["groups"] == [] and result["page"] == 1
    assert all(row["group_id"] is None for row in result["list"])
    assert len({row["updated_at"] for row in result["list"]}) == 1
    assert (
        client.get("/api/v1/bookmarks", params={"group": group_id}).status_code == 404
    )
    resolved = client.post(f"/api/v1/bookmark-operations/{delete_key}/resolve").json()[
        "data"
    ]
    assert resolved["status"] == "succeeded" and resolved["changed_count"] == 3


@pytest.mark.parametrize(
    "name", ["", "  ", "😀" * 31, "全部", " 未分组 ", "private\x00name"]
)
@pytest.mark.parametrize("method", ["post", "patch"])
def test_group_name_boundary_is_safe_field_error(client, owner, name, method):
    path = "/api/v1/bookmark-groups"
    if method == "patch":
        created = write(client, {"name": "Original"}, path=path).json()["data"]
        path += f"/{created['resource_id']}"
    response = write(client, {"name": name}, method=method, path=path)
    assert response.status_code == 422
    issues = response.json()["data"]
    assert any(issue["loc"] == ["body", "name"] for issue in issues)
    assert all(set(issue) == {"loc", "type", "msg"} for issue in issues)
    assert "private" not in response.text
    groups = client.get("/api/v1/bookmarks").json()["data"]["groups"]
    if method == "post":
        assert groups == []
    else:
        assert groups[0]["name"] == "Original"


def test_group_name_codepoints_only_ascii_fold_empty_delete_and_fence(client, owner):
    for name in ("😀" * 30, "Ä", "ä", "All", "Ungrouped"):
        assert (
            write(client, {"name": name}, path="/api/v1/bookmark-groups").status_code
            == 200
        )
    groups = client.get("/api/v1/bookmarks").json()["data"]["groups"]
    group_id = next(row["id"] for row in groups if row["name"] == "😀" * 30)
    assert {row["name"] for row in groups} == {"😀" * 30, "Ä", "ä", "All", "Ungrouped"}
    assert (
        write(
            client, method="delete", path=f"/api/v1/bookmark-groups/{group_id}"
        ).status_code
        == 422
    )
    assert (
        write(
            client,
            method="delete",
            path=f"/api/v1/bookmark-groups/{group_id}?expected_count=-1",
        ).status_code
        == 422
    )
    assert (
        write(
            client,
            method="delete",
            path=f"/api/v1/bookmark-groups/{group_id}?expected_count=0",
        ).json()["data"]["changed_count"]
        == 0
    )
    fenced_key = uuid4()
    assert (
        client.post(f"/api/v1/bookmark-operations/{fenced_key}/resolve").json()["data"][
            "status"
        ]
        == "not_executed"
    )
    assert (
        write(
            client, {"name": "Late"}, path="/api/v1/bookmark-groups", key=fenced_key
        ).json()["code"]
        == 40913
    )
    target = write(client, {"name": "Second"}, path="/api/v1/bookmark-groups").json()[
        "data"
    ]["resource_id"]
    assert (
        write(
            client,
            {"name": "all"},
            method="patch",
            path=f"/api/v1/bookmark-groups/{target}",
        ).json()["code"]
        == 40910
    )
    result = client.get("/api/v1/bookmarks").json()["data"]["groups"]
    assert next(row["name"] for row in result if row["id"] == target) == "Second"


def test_batch_route_mixed_sources_replay_noop_and_null_target(client, owner):
    source, target = [
        write(client, {"name": name}, path="/api/v1/bookmark-groups").json()["data"][
            "resource_id"
        ]
        for name in ("Source", "Target")
    ]
    ids = [
        write(client, payload(title=f"Item {index}", group_id=group_id)).json()["data"][
            "resource_id"
        ]
        for index, group_id in enumerate((target, source, None))
    ]
    original = {
        row["id"]: row for row in client.get("/api/v1/bookmarks").json()["data"]["list"]
    }
    key = uuid4()
    body = {"bookmark_ids": ids, "target_group_id": target}
    moved = write(client, body, path="/api/v1/bookmarks/batch-move", key=key)
    assert moved.status_code == 200
    receipt = moved.json()["data"]
    assert receipt == {
        "operation_id": str(key),
        "kind": "batch_move",
        "resource_id": None,
        "changed_count": 2,
    }
    after = client.get("/api/v1/bookmarks").json()["data"]
    assert {row["id"]: row["count"] for row in after["groups"]} == {
        source: 0,
        target: 3,
    }
    assert after["all_count"] == 3 and after["ungrouped_count"] == 0
    assert next(row for row in after["list"] if row["id"] == ids[0]) == original[ids[0]]
    assert (
        write(
            client,
            {**body, "bookmark_ids": list(reversed(ids))},
            path="/api/v1/bookmarks/batch-move",
            key=key,
        ).json()["data"]
        == receipt
    )
    assert client.get("/api/v1/bookmarks").json()["data"] == after
    assert (
        write(client, body, path="/api/v1/bookmarks/batch-move").json()["data"][
            "changed_count"
        ]
        == 0
    )
    assert client.get("/api/v1/bookmarks").json()["data"] == after
    assert (
        write(
            client,
            {**body, "target_group_id": None},
            path="/api/v1/bookmarks/batch-move",
            key=key,
        ).json()["code"]
        == 40911
    )
    assert (
        write(
            client,
            {**body, "target_group_id": None},
            path="/api/v1/bookmarks/batch-move",
        ).json()["data"]["changed_count"]
        == 3
    )
    resolved = client.post(f"/api/v1/bookmark-operations/{key}/resolve").json()["data"]
    assert resolved["kind"] == "batch_move" and resolved["status"] == "succeeded"
    assert resolved["resource_id"] is None and resolved["changed_count"] == 2


@pytest.mark.parametrize(
    "bad_object",
    ["missing_source", "foreign_source", "missing_target", "foreign_target"],
)
def test_batch_unavailable_objects_fail_wholly_and_leave_durable_receipt(
    client, owner, bad_object
):
    identity, user_id, other_id = owner
    valid_id = write(client, payload()).json()["data"]["resource_id"]
    identity["id"] = other_id
    foreign_id = write(client, payload()).json()["data"]["resource_id"]
    foreign_target = write(
        client, {"name": "Private"}, path="/api/v1/bookmark-groups"
    ).json()["data"]["resource_id"]
    identity["id"] = user_id
    body = {"bookmark_ids": [valid_id], "target_group_id": None}
    if "source" in bad_object:
        body["bookmark_ids"].append(
            foreign_id if bad_object == "foreign_source" else str(uuid4())
        )
    else:
        body["target_group_id"] = (
            foreign_target if bad_object == "foreign_target" else str(uuid4())
        )
    before = client.get("/api/v1/bookmarks").json()["data"]
    key = uuid4()
    rejected = write(client, body, path="/api/v1/bookmarks/batch-move", key=key)
    assert rejected.status_code == 409 and rejected.json()["code"] == 40914
    assert client.get("/api/v1/bookmarks").json()["data"] == before
    assert (
        write(client, body, path="/api/v1/bookmarks/batch-move", key=key).json()["code"]
        == 40914
    )
    failed = client.post(f"/api/v1/bookmark-operations/{key}/resolve").json()["data"]
    assert failed["kind"] == "batch_move" and failed["status"] == "failed"
    assert (
        failed["resource_id"] is None
        and failed["changed_count"] == 0
        and failed["error_code"] == 40914
    )


@pytest.mark.parametrize(
    "bad_input",
    [
        "empty",
        "too_many",
        "duplicate",
        "invalid_id",
        "invalid_target",
        "missing_target",
        "owner",
    ],
)
def test_batch_payload_constraints_are_safe_field_errors(client, owner, bad_input):
    bookmark_id = write(client, payload()).json()["data"]["resource_id"]
    body = {"bookmark_ids": [bookmark_id], "target_group_id": None}
    field = "bookmark_ids"
    if bad_input == "empty":
        body[field] = []
    elif bad_input == "too_many":
        body[field] = [str(uuid4()) for _ in range(11)]
    elif bad_input == "duplicate":
        body[field] = [bookmark_id, bookmark_id.upper()]
    elif bad_input == "invalid_id":
        body[field] = ["invalid"]
    elif bad_input == "invalid_target":
        field = "target_group_id"
        body[field] = "invalid"
    elif bad_input == "missing_target":
        field = "target_group_id"
        body.pop(field)
    else:
        field = "owner"
        body[field] = 1
    response = write(client, body, path="/api/v1/bookmarks/batch-move")
    assert response.status_code == 422
    issues = response.json()["data"]
    assert any(field in issue["loc"] for issue in issues)
    assert all(set(issue) == {"loc", "type", "msg"} for issue in issues)
    assert client.get("/api/v1/bookmarks").json()["data"]["total"] == 1


def test_batch_maximum_ten_and_resolve_fences_late_request(client, owner):
    target = write(client, {"name": "Target"}, path="/api/v1/bookmark-groups").json()[
        "data"
    ]["resource_id"]
    ids = [
        write(client, payload(title=f"Item {index}")).json()["data"]["resource_id"]
        for index in range(10)
    ]
    body = {"bookmark_ids": ids, "target_group_id": target}
    fenced_key = uuid4()
    client.post(f"/api/v1/bookmark-operations/{fenced_key}/resolve")
    assert (
        write(client, body, path="/api/v1/bookmarks/batch-move", key=fenced_key).json()[
            "code"
        ]
        == 40913
    )
    assert client.get("/api/v1/bookmarks").json()["data"]["ungrouped_count"] == 10
    assert (
        write(client, body, path="/api/v1/bookmarks/batch-move").json()["data"][
            "changed_count"
        ]
        == 10
    )


def test_bookmarks_require_authentication(client):
    assert client.get("/api/v1/bookmarks").status_code == 401
    assert write(client, payload()).status_code == 401
    assert (
        client.post(f"/api/v1/bookmark-operations/{uuid4()}/resolve").status_code == 401
    )
