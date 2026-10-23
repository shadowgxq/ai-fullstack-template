"""Task-owned PG UUID schema and Redis random-prefix integration, no live HTTP."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import sys
from threading import Barrier, Event
import time
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from PIL import Image
import pytest
from redis import Redis
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import event, func, inspect, select, text
from sqlalchemy.orm import Session

from app.api.dependencies import (
    get_geocoder,
    get_media_service,
    get_weather_source,
    get_wechat_code_exchange,
)
from app.core import redis_client as redis_module
from app.core.exceptions import BusinessException
from app.core.session import get_db
from app.core.weather_catalog import verified_rows
from app.models.account_revision import AccountRevision
from app.models.garment import Garment
from app.models.user_profile import UserProfile
from app.models.wardrobe_preferences import WardrobePreferences
from app.models.weather_context import WeatherContext
from app.models.weather_region import WeatherRegion
from app.models.wear_record import WearRecord, WearRecordItem
from app.repositories.media_repository import MediaRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.region_repository import RegionRepository
from app.repositories.revision_repository import RevisionRepository
from app.repositories.weather_repository import WeatherRepository
from app.schemas.profile import ProfilePatch
from app.schemas.weather import WeatherContextRequest, WeatherFacts, WeatherForecast
from app.services import auth_redis_service, cache_service
from app.services.media_service import MediaService
from app.services.media_store import MediaStore
from app.services.profile_service import ProfileService
from app.services.region_service import RegionService
from app.services.weather_cache import CachedWeather, WeatherCache
from app.services.weather_service import WeatherService
from app.services.weather_source import GeocodedPlace, SourceUnavailable, parse_weather
from app.services.weather_time import SHANGHAI, day_end, day_start, now_shanghai
from app.services.wechat_service import WechatAccountIdentity
from main import app
from test_preferences import empty_payload
from test_weather import FIXTURES, hangzhou
import test_garment_postgres
import test_wechat_postgres

postgres_database = test_wechat_postgres.postgres_database
BACKEND_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def weather_redis():
    url = os.environ.get("WARDROBE_TEST_REDIS_URL")
    if not url:
        pytest.skip("Explicit task Redis URL is required")
    assert url == "redis://127.0.0.1:56379/14"
    redis = Redis.from_url(
        url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2
    )
    assert redis.ping()
    prefix = f"weather-test-{uuid4().hex}:"
    try:
        yield redis, prefix
    finally:
        keys = list(redis.scan_iter(match=prefix + "*"))
        if keys:
            redis.delete(*keys)
        redis.close()


def fresh_facts(region, now):
    """Synthetic clock boundary fact, never reported as the official fixture."""
    return WeatherFacts(
        source="weather.com.cn",
        parser_version="weather1d.v1",
        fetched_at=now,
        valid_until=day_end(now.astimezone(SHANGHAI).date()),
        observation=None,
        forecast=WeatherForecast(
            forecast_date=now.astimezone(SHANGHAI).date(),
            issued_at=now,
            day_summary="boundary test",
            night_summary=None,
            high_c=None,
            low_c=None,
        ),
    )


def test_migration_persists_exact_directory_preserves_all_old_facts_and_metadata(
    postgres_database,
):
    engine, migrate = postgres_database
    migrate("d174ff3dc01d")
    old_avatar = uuid4()
    with engine.begin() as conn:
        owner = conn.scalar(
            text("INSERT INTO users(username) VALUES ('weather-legacy') RETURNING id")
        )
        conn.execute(
            text(
                "INSERT INTO user_profiles(user_id,nickname,avatar_media_id,city_id,version) VALUES (:id,'保留昵称',:avatar,'legacy-city',7)"
            ),
            {"id": owner, "avatar": old_avatar},
        )
        conn.execute(
            text(
                "INSERT INTO account_revisions(owner_id,inventory_revision,history_revision,preferences_revision) VALUES (:id,3,4,5)"
            ),
            {"id": owner},
        )
        conn.execute(
            text(
                "INSERT INTO wardrobe_preferences(owner_id,liked_styles,avoided_styles,liked_colors,avoided_colors,liked_occasions,avoided_occasions,comfort_notes,version) VALUES (:id,'[\"casual\"]','[]','[]','[]','[]','[]','保留舒适文本',2)"
            ),
            {"id": owner},
        )
        garment_id, record_id = uuid4(), uuid4()
        conn.execute(
            text(
                "INSERT INTO garments(id,owner_id,name,season,occasion,tags,status,version,created_at,updated_at) VALUES (:id,:owner,'保留衣物','[]','[]','[]','wearable',2,now(),now())"
            ),
            {"id": garment_id, "owner": owner},
        )
        conn.execute(
            text(
                "INSERT INTO wear_records(id,owner_id,wear_date,version,created_at,updated_at) VALUES (:id,:owner,'2020-01-01',3,now(),now())"
            ),
            {"id": record_id, "owner": owner},
        )
        conn.execute(
            text(
                "INSERT INTO wear_record_items(record_id,garment_id,name_snapshot,category_snapshot) VALUES (:record,:garment,'历史快照','tops')"
            ),
            {"record": record_id, "garment": garment_id},
        )
    migrate("head")
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(WeatherRegion)) == 3216
        assert db.scalar(select(func.count()).select_from(WeatherContext)) == 0
        expected = {r["region_id"]: r for r in verified_rows()}
        for row in db.scalars(select(WeatherRegion)):
            assert {k: getattr(row, k) for k in expected[row.region_id]} == expected[
                row.region_id
            ]
        profile = db.get(UserProfile, owner)
        assert (
            profile.nickname,
            profile.avatar_media_id,
            profile.city_id,
            profile.version,
        ) == ("保留昵称", old_avatar, "legacy-city", 7)
        revision = db.get(AccountRevision, owner)
        assert (
            revision.inventory_revision,
            revision.history_revision,
            revision.preferences_revision,
        ) == (3, 4, 5)
        assert db.get(WardrobePreferences, owner).comfort_notes == "保留舒适文本"
        assert db.get(WardrobePreferences, owner).liked_styles == ["casual"]
        assert db.get(WardrobePreferences, owner).version == 2
        assert db.get(Garment, garment_id).name == "保留衣物"
        assert db.get(WearRecord, record_id).version == 3
        assert (
            db.get(WearRecordItem, (record_id, garment_id)).name_snapshot == "历史快照"
        )
    assert {
        "ck_weather_state",
        "ck_weather_selection",
        "ck_weather_missing_reason",
    } <= {c["name"] for c in inspect(engine).get_check_constraints("weather_contexts")}
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "check"],
        cwd=BACKEND_ROOT,
        env=dict(
            os.environ, DATABASE_URL=engine.url.render_as_string(hide_password=False)
        ),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_city_patch_same_version_has_one_winner_and_commit_failure_rolls_back(
    postgres_database,
):
    engine, migrate = postgres_database
    migrate("head")
    owner = test_garment_postgres.create_owner(engine)
    barrier = Barrier(2)

    class RacingRevision(RevisionRepository):
        def lock(self, user_id):
            barrier.wait(timeout=10)
            return super().lock(user_id)

    def save(city):
        with Session(engine) as db:
            try:
                return ProfileService(
                    ProfileRepository(db),
                    RacingRevision(db),
                    MediaRepository(db),
                    RegionRepository(db),
                ).patch(owner, ProfilePatch(expected_version=1, city_id=city))
            except BusinessException as error:
                return error

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(save, ["cn-101210101", "cn-101210102"]))
    success = [r for r in results if not isinstance(r, BusinessException)]
    assert len(success) == 1 and [
        r.code for r in results if isinstance(r, BusinessException)
    ] == [40950]
    with Session(engine) as db:
        service = ProfileService(
            ProfileRepository(db),
            RevisionRepository(db),
            MediaRepository(db),
            RegionRepository(db),
        )

        def fail(session):
            raise RuntimeError("injected weather city commit")

        event.listen(db, "before_commit", fail)
        try:
            with pytest.raises(RuntimeError):
                service.patch(
                    owner,
                    ProfilePatch(expected_version=2, city_id=None, nickname="不得保存"),
                )
        finally:
            event.remove(db, "before_commit", fail)
    with Session(engine) as db:
        profile = db.get(UserProfile, owner)
        assert (profile.city_id, profile.nickname, profile.version) == (
            success[0].city_id,
            None,
            2,
        )
        revision = db.get(AccountRevision, owner)
        assert (
            revision.inventory_revision,
            revision.history_revision,
            revision.preferences_revision,
        ) == (0, 0, 0)


def test_real_redis_single_fetch_waiter_and_seven_day_expireat(weather_redis):
    redis, prefix = weather_redis
    entered, resume = Event(), Event()

    class Source:
        calls = 0

        def fetch(self, region, now):
            self.calls += 1
            entered.set()
            assert resume.wait(timeout=5)
            return fresh_facts(region, now)

    source = Source()
    cache = WeatherCache(
        redis, source, prefix=prefix, wait_attempts=100, wait_seconds=0.01
    )
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(cache.get, hangzhou())
        assert entered.wait(timeout=5)
        second = pool.submit(cache.get, hangzhou())
        time.sleep(0.04)
        resume.set()
        a, b = first.result(timeout=10), second.result(timeout=10)
    assert a == b and a.facts and source.calls == 1
    day = now_shanghai().date()
    key = cache.key(hangzhou(), day)
    assert redis.expiretime(key) == int(day_start(day + timedelta(days=7)).timestamp())
    assert redis.get(key + ":lock") is None
    assert not any(
        word in redis.get(key)
        for word in ("owner_id", "latitude", "longitude", "token")
    )


def test_real_redis_negative_ttl_then_retry_and_nonholder_bound(weather_redis):
    redis, prefix = weather_redis

    class Source:
        calls = 0

        def fetch(self, region, now):
            self.calls += 1
            raise SourceUnavailable()

    source = Source()
    cache = WeatherCache(
        redis, source, prefix=prefix, wait_attempts=2, wait_seconds=0.001
    )
    assert cache.get(hangzhou()).missing_reason == "upstream_unavailable"
    assert (
        cache.get(hangzhou()).missing_reason == "upstream_unavailable"
        and source.calls == 1
    )
    key = cache.key(hangzhou(), now_shanghai().date())
    assert 0 < redis.ttl(key) <= 60
    redis.delete(key)
    assert (
        cache.get(hangzhou()).missing_reason == "upstream_unavailable"
        and source.calls == 2
    )
    redis.delete(key)
    redis.set(key + ":lock", "other", ex=15)
    assert cache.get(hangzhou()).missing_reason == "cache_busy" and source.calls == 2
    assert redis.get(key + ":lock") == "other"


def test_real_redis_lost_token_and_midnight_cannot_publish_or_release_successor(
    weather_redis,
):
    redis, prefix = weather_redis

    class Source:
        def fetch(self, region, now):
            redis.set(cache.key(region, now.date()) + ":lock", "successor-token", ex=15)
            return fresh_facts(region, now)

    cache = WeatherCache(redis, Source(), prefix=prefix)
    result = cache.get(hangzhou())
    key = cache.key(hangzhou(), now_shanghai().date())
    assert result.missing_reason == "lock_lost" and redis.get(key) is None
    assert redis.get(key + ":lock") == "successor-token"
    tomorrow = now_shanghai().date() + timedelta(days=1)
    times = [day_end(tomorrow) - timedelta(seconds=1)]

    class Crossing:
        def fetch(self, region, now):
            fact = fresh_facts(region, now)
            times[0] += timedelta(seconds=2)
            return fact

    cache = WeatherCache(
        redis, Crossing(), prefix=prefix + "midnight:", clock=lambda: times[0]
    )
    assert cache.get(hangzhou()).missing_reason == "day_changed"
    assert redis.get(cache.key(hangzhou(), tomorrow)) is None
    # Redis TIME fences a writer even if its application clock is stale.
    old = now_shanghai() - timedelta(days=1)
    cache = WeatherCache(
        redis,
        type("Source", (), {"fetch": staticmethod(fresh_facts)})(),
        prefix=prefix + "stale:",
        clock=lambda: old,
    )
    assert cache.get(hangzhou()).missing_reason == "day_changed"
    assert redis.get(cache.key(hangzhou(), old.date())) is None


def test_real_redis_bad_cache_identity_or_nonfinite_facts_is_refetched(weather_redis):
    redis, prefix = weather_redis

    class Source:
        calls = 0

        def fetch(self, region, now):
            self.calls += 1
            return fresh_facts(region, now)

    source = Source()
    cache = WeatherCache(redis, source, prefix=prefix)
    day = now_shanghai().date()
    key = cache.key(hangzhou(), day)
    initial = CachedWeather(
        region_id=hangzhou().region_id,
        weather_date=day,
        facts=fresh_facts(hangzhou(), now_shanghai()),
        missing_reason=None,
    ).model_dump(mode="json")
    for mutate in (
        lambda d: d.__setitem__("region_id", "cn-101210102"),
        lambda d: d.__setitem__("weather_date", "2000-01-01"),
        lambda d: d["facts"]["forecast"].__setitem__("high_c", float("nan")),
    ):
        bad = json.loads(json.dumps(initial))
        mutate(bad)
        redis.set(key, json.dumps(bad))
        assert cache.get(hangzhou()).facts
    assert source.calls == 3


def test_real_redis_second_check_and_publish_fault_do_not_refetch(weather_redis):
    redis, prefix = weather_redis

    class Source:
        calls = 0

        def fetch(self, region, at):
            self.calls += 1
            return fresh_facts(region, at)

    source = Source()
    now = now_shanghai()
    value = CachedWeather(
        region_id=hangzhou().region_id,
        weather_date=now.date(),
        facts=fresh_facts(hangzhou(), now),
        missing_reason=None,
    )

    class Predecessor:
        def get(self, key):
            return redis.get(key)

        def set(self, key, token, **kwargs):
            acquired = redis.set(key, token, **kwargs)
            redis.set(key.removesuffix(":lock"), value.model_dump_json(), ex=60)
            return acquired

        def eval(self, *args):
            return redis.eval(*args)

    cache = WeatherCache(Predecessor(), source, prefix=prefix + "second:")
    assert cache.get(hangzhou()) == value and source.calls == 0

    class PublishFault:
        def get(self, key):
            return redis.get(key)

        def set(self, *args, **kwargs):
            return redis.set(*args, **kwargs)

        def eval(self, script, *args):
            if len(args) == 8:
                raise RedisConnectionError("injected publish boundary failure")
            return redis.eval(script, *args)

    cache = WeatherCache(PublishFault(), source, prefix=prefix + "fault:")
    assert cache.get(hangzhou()).facts and source.calls == 1
    key = cache.key(hangzhou(), now.date())
    assert redis.get(key) is None and redis.get(key + ":lock") is None


def test_real_pg_redis_http_phase_flow_context_owner_expiry_and_no_io_transactions(
    postgres_database, weather_redis, monkeypatch, tmp_path
):
    engine, migrate = postgres_database
    migrate("head")
    redis, prefix = weather_redis
    monkeypatch.setattr(auth_redis_service, "TOKEN_BLACKLIST_PREFIX", prefix + "jwt:")
    monkeypatch.setattr(cache_service, "USER_CACHE_PREFIX", prefix + "user:")
    for module in (redis_module, auth_redis_service, cache_service):
        monkeypatch.setattr(module, "redis_client", redis)
    active = []
    io_states = []

    def database_session():
        with Session(engine) as db:
            active.append(db)
            try:
                yield db
            finally:
                active.remove(db)

    class Exchange:
        def exchange(self, code):
            return WechatAccountIdentity("wx-weather-boundary-test", code)

    class OfficialFixture:
        calls = 0

        def fetch(self, region, at):
            io_states.append(("weather", [db.in_transaction() for db in active]))
            assert not any(io_states[-1][1])
            self.calls += 1
            if region.region_id != "cn-101210101":
                raise SourceUnavailable()
            return parse_weather(
                (FIXTURES / "hangzhou-2026-10-22.html").read_bytes(), region, at
            )

    source = OfficialFixture()

    class Geo:
        def reverse(self, location):
            io_states.append(("map", [db.in_transaction() for db in active]))
            assert not any(io_states[-1][1])
            return GeocodedPlace("浙江省", "杭州市", "萧山区")

    # Request-scoped media dependency must use the same real session as get_db.
    from fastapi import Depends

    def media_dependency(db: Session = Depends(get_db)):
        return MediaService(
            MediaRepository(db),
            RevisionRepository(db),
            MediaStore(tmp_path / "private-media"),
        )

    overrides = {
        get_db: database_session,
        get_wechat_code_exchange: Exchange,
        get_weather_source: lambda: source,
        get_geocoder: Geo,
        get_media_service: media_dependency,
    }
    app.dependency_overrides.update(overrides)
    # Only weather keys change prefix; authentication uses its own scoped keys.
    import app.api.dependencies as deps

    original_cache = deps.WeatherCache
    monkeypatch.setattr(
        deps,
        "WeatherCache",
        lambda redis, source: original_cache(redis, source, prefix=prefix + "public:"),
    )
    captured = {}

    def data(response):
        assert response.status_code == 200, response.text
        assert response.json()["code"] == 0
        return response.json()["data"]

    try:
        with TestClient(app) as client:
            accounts = [
                data(client.post("/api/v1/auth/wechat", json={"code": code}))
                for code in ("owner", "other")
            ]
            own, other = [
                {"Authorization": "Bearer " + a["access_token"]} for a in accounts
            ]
            owner_id, other_id = [a["user"]["id"] for a in accounts]
            cities = captured["cities"] = data(
                client.get("/api/v1/cities", params={"q": "杭州"}, headers=own)
            )
            assert cities["items"][0]["city_id"] == "cn-101210101"
            captured["cities_disambiguated"] = data(
                client.get("/api/v1/cities", params={"q": "朝阳"}, headers=own)
            )
            assert (
                len(
                    [
                        r
                        for r in captured["cities_disambiguated"]["items"]
                        if r["district"] == "朝阳"
                    ]
                )
                == 3
            )
            captured["cities_page"] = data(
                client.get("/api/v1/cities", params={"q": "广东"}, headers=own)
            )
            captured["cities_next"] = data(
                client.get(
                    "/api/v1/cities",
                    params={
                        "q": "广东",
                        "cursor": captured["cities_page"]["next_cursor"],
                    },
                    headers=own,
                )
            )
            assert captured["cities_page"]["next_cursor"]
            assert (
                client.get(
                    "/api/v1/cities",
                    params={
                        "q": "杭州",
                        "cursor": captured["cities_page"]["next_cursor"],
                    },
                    headers=own,
                ).status_code
                == 422
            )
            default = captured["default"] = data(
                client.post("/api/v1/weather/context", json={}, headers=own)
            )
            assert (
                default["selection_source"] == "default"
                and default["region"]["city_id"] == "cn-101210101"
            )
            # Explicit requests never silently change to default.
            assert (
                client.post(
                    "/api/v1/weather/context", json={"city_id": "unknown"}, headers=own
                ).status_code
                == 422
            )
            picture = BytesIO()
            Image.new("RGB", (8, 8), "blue").save(picture, format="JPEG")
            avatar = data(
                client.post(
                    "/api/v1/media",
                    headers={**own, "Idempotency-Key": "phase-avatar"},
                    data={"purpose": "avatar"},
                    files={"file": ("a.jpg", picture.getvalue(), "image/jpeg")},
                )
            )
            profile = data(
                client.patch(
                    "/api/v1/profile",
                    headers=own,
                    json={
                        "expected_version": 1,
                        "nickname": "测试昵称",
                        "avatar_media_id": avatar["id"],
                    },
                )
            )
            garment = data(
                client.post(
                    "/api/v1/garments",
                    headers={**own, "Idempotency-Key": "phase-garment"},
                    json={"name": "测试衣物"},
                )
            )
            record = data(
                client.post(
                    "/api/v1/wear-records",
                    headers={**own, "Idempotency-Key": "phase-record"},
                    json={"wear_date": "2020-01-01", "garment_ids": [garment["id"]]},
                )
            )
            preferences = data(
                client.put(
                    "/api/v1/preferences",
                    headers=own,
                    json={
                        **empty_payload(),
                        "liked_styles": ["casual"],
                        "comfort_notes": "测试舒适文本",
                    },
                )
            )
            with Session(engine) as db:
                revision = db.get(AccountRevision, owner_id)
                before = (
                    revision.inventory_revision,
                    revision.history_revision,
                    revision.preferences_revision,
                )
            assert before == (1, 1, 1)
            saved = captured["profile_saved"] = data(
                client.patch(
                    "/api/v1/profile",
                    headers=own,
                    json={
                        "expected_version": profile["version"],
                        "city_id": "cn-101210101",
                    },
                )
            )
            assert saved == {
                **profile,
                "city_id": "cn-101210101",
                "version": profile["version"] + 1,
            }
            assert data(client.get("/api/v1/profile", headers=own)) == saved
            context = captured["saved"] = data(
                client.post("/api/v1/weather/context", json={}, headers=own)
            )
            assert context["selection_source"] == "saved"
            captured["selected"] = data(
                client.post(
                    "/api/v1/weather/context",
                    json={"city_id": "cn-101210101"},
                    headers=own,
                )
            )
            captured["location"] = data(
                client.post(
                    "/api/v1/weather/context",
                    json={
                        "location": {
                            "latitude": 30.0,
                            "longitude": 120.0,
                            "coordinate_system": "gcj02",
                            "accuracy": "fuzzy",
                        }
                    },
                    headers=own,
                )
            )
            assert (
                captured["location"]["selection_source"] == "location"
                and captured["location"]["region"]["city_id"] == "cn-101210102"
            )
            missing = captured["missing"] = data(
                client.post(
                    "/api/v1/weather/context",
                    json={"city_id": "cn-101210102"},
                    headers=own,
                )
            )
            assert (
                missing["state"] == "missing"
                and missing["facts"] is None
                and missing["missing_reason"] == "upstream_unavailable"
            )
            assert source.calls == 2
            assert data(client.get("/api/v1/preferences", headers=own)) == preferences
            assert (
                data(client.get("/api/v1/wear-records/" + record["id"], headers=own))[
                    "items"
                ][0]["name_snapshot"]
                == "测试衣物"
            )
            stats = data(client.get("/api/v1/statistics", headers=own))
            assert (stats["wardrobe_total"], stats["wear_record_count"]) == (1, 1)
            assert data(client.get("/api/v1/profile", headers=other))["city_id"] is None
            other_context = data(
                client.post("/api/v1/weather/context", json={}, headers=other)
            )
            assert other_context["selection_source"] == "default"
            assert (
                client.post(
                    "/api/v1/weather/context", json={"owner_id": other_id}, headers=own
                ).status_code
                == 422
            )
            with Session(engine) as db:
                revision = db.get(AccountRevision, owner_id)
                assert (
                    revision.inventory_revision,
                    revision.history_revision,
                    revision.preferences_revision,
                ) == before
                service = WeatherService(
                    WeatherRepository(db),
                    ProfileRepository(db),
                    RegionService(RegionRepository(db), "test"),
                    WeatherCache(redis, source, prefix=prefix + "public:"),
                    Geo(),
                )
                assert (
                    service.get_owned_context(
                        owner_id, UUID(context["context_id"])
                    ).model_dump(mode="json")
                    == context
                )
                with pytest.raises(BusinessException) as error:
                    service.get_owned_context(other_id, UUID(context["context_id"]))
                assert error.value.code == 40470
                service.clock = lambda: day_end(
                    datetime.fromisoformat(context["valid_until"]).date()
                )
                with pytest.raises(BusinessException) as error:
                    service.get_owned_context(owner_id, UUID(context["context_id"]))
                assert error.value.code == 40973
                persisted = db.get(WeatherContext, UUID(context["context_id"]))
                assert all(
                    word not in json.dumps(persisted.payload_snapshot)
                    for word in (
                        "latitude",
                        "longitude",
                        "coordinate_system",
                        "token",
                        "key",
                    )
                )
            captured["profile_cleared"] = data(
                client.patch(
                    "/api/v1/profile",
                    headers=own,
                    json={"expected_version": saved["version"], "city_id": None},
                )
            )
            assert captured["profile_cleared"] == {
                **saved,
                "city_id": None,
                "version": saved["version"] + 1,
            }

            class DownWeatherCache:
                def get(self, key):
                    raise RedisConnectionError("injected optional cache boundary")

            with monkeypatch.context() as patch:
                patch.setattr(
                    deps,
                    "WeatherCache",
                    lambda redis, source: original_cache(DownWeatherCache(), source),
                )
                captured["cache_fallback"] = data(
                    client.post("/api/v1/weather/context", json={}, headers=own)
                )
                assert source.calls == 3
                assert captured["cache_fallback"]["selection_source"] == "default"
            # Auth Redis failure is fail-closed, before optional weather source work.
            count = source.calls

            class DownAuth:
                def exists(self, *args):
                    raise RedisConnectionError("isolated auth outage")

            with monkeypatch.context() as patch:
                patch.setattr(auth_redis_service, "redis_client", DownAuth())
                assert (
                    client.post(
                        "/api/v1/weather/context", json={}, headers=own
                    ).status_code
                    == 503
                )
                assert source.calls == count
            assert data(client.post("/api/v1/auth/logout", headers=own)) is None
            assert (
                client.post("/api/v1/weather/context", json={}, headers=own).status_code
                == 401
            )
            assert (
                client.get(
                    "/api/v1/cities", params={"q": "杭州"}, headers=own
                ).status_code
                == 401
            )
            assert client.get("/api/v1/profile", headers=own).status_code == 401
            assert client.post("/api/v1/weather/context", json={}).status_code == 401
            assert client.get("/api/v1/cities", params={"q": "杭州"}).status_code == 401
            assert {"weather", "map"} == {kind for kind, _ in io_states}
            assert all(not any(states) for _, states in io_states)
        output = os.environ.get("WARDROBE_WEATHER_CONSUMER_RESPONSES")
        if output:
            expected = (
                BACKEND_ROOT.parent
                / ".tools/manager-runtime/weather-consumer-responses.json"
            )
            assert Path(output).resolve() == expected.resolve()
            expected.parent.mkdir(parents=True, exist_ok=True)
            expected.write_text(
                json.dumps(captured, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
    finally:
        for dep in overrides:
            app.dependency_overrides.pop(dep, None)


def test_context_commit_failure_keeps_no_partial_context(
    postgres_database, weather_redis
):
    engine, migrate = postgres_database
    migrate("head")
    owner = test_garment_postgres.create_owner(engine)
    redis, prefix = weather_redis

    class Source:
        def fetch(self, region, at):
            return fresh_facts(region, at)

    with Session(engine) as db:
        service = WeatherService(
            WeatherRepository(db),
            ProfileRepository(db),
            RegionService(RegionRepository(db), "test"),
            WeatherCache(redis, Source(), prefix=prefix),
            None,
        )

        def fail(session):
            raise RuntimeError("injected context commit failure")

        # Install after the read transaction and flush, then fail the real commit.
        original = service.repo.create

        def create_then_fail(*args):
            original(*args)
            event.listen(db, "before_commit", fail, once=True)

        service.repo.create = create_then_fail
        with pytest.raises(RuntimeError):
            service.create(owner, WeatherContextRequest())
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(WeatherContext)) == 0
        assert db.get(UserProfile, owner).city_id is None
