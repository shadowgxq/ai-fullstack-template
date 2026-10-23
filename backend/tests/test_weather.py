"""Frozen official source facts and local boundary checks; no live HTTP."""

from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from urllib.error import HTTPError

import pytest
from pydantic import ValidationError
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import event

from app.core.exceptions import BusinessException
from app.core.config import Settings
from app.core.session import transaction
from app.core.weather_catalog import MAPPING_VERSION, verified_rows
from app.models.weather_region import WeatherRegion
from app.repositories.region_repository import RegionRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.weather_repository import WeatherRepository
from app.schemas.profile import ProfilePatch
from app.schemas.weather import FuzzyLocation, RegionView, WeatherContextRequest
from app.services.region_service import RegionService
from app.services.weather_cache import CachedWeather, WeatherCache
from app.services.weather_service import WeatherService
from app.services import weather_source
from app.services.weather_source import (
    InvalidWeatherSource,
    SourceUnavailable,
    TencentGeocoder,
    OfficialWeatherSource,
    parse_weather,
)
from app.services.weather_time import SHANGHAI, day_end
from scripts.freeze_weather_regions import freeze, literal_assignment
from test_profile import profile_service
import test_profile

profiles = test_profile.profiles

FIXTURES = Path(__file__).parent / "fixtures/weather"
NOW = datetime(2026, 10, 22, 22, tzinfo=SHANGHAI)


def hangzhou():
    row = next(row for row in verified_rows() if row["region_id"] == "cn-101210101")
    return RegionView(city_id=row["region_id"], **row)


def source_facts(region=None, now=NOW):
    return parse_weather(
        (FIXTURES / "hangzhou-2026-10-22.html").read_bytes(), region or hangzhou(), now
    )


def seed_regions(db):
    with transaction(db):
        db.add_all(WeatherRegion(**row) for row in verified_rows())


def test_catalog_reproduces_official_raw_and_rejects_conflicts():
    data = freeze(FIXTURES)
    assert data["mapping_version"] == MAPPING_VERSION
    assert data["regions"] == [
        {k: v for k, v in row.items() if k != "mapping_version"}
        for row in verified_rows()
    ]
    assert len(data["regions"]) == 3216
    indexed = {row["weather_code"]: row for row in data["regions"]}
    assert "101044100" not in indexed  # duplicate mobile names, not first-row wins
    assert "101031400" not in indexed  # 蓟州 / 蓟县 disagreement
    assert "101210111" not in indexed  # PC-only 江干
    assert {
        (row["province"], row["city"], row["district"])
        for row in data["regions"]
        if row["district"] == "朝阳"
    } == {("北京", "北京", "朝阳"), ("吉林", "长春", "朝阳"), ("辽宁", "朝阳", "朝阳")}
    assert indexed["101210101"]["display_name"] == "浙江 / 杭州 / 杭州"
    for label in ("mobile-city-data", "pc-city"):
        meta = json.loads((FIXTURES / (label + ".meta.json")).read_text())
        assert (
            hashlib.sha256((FIXTURES / (label + ".raw")).read_bytes()).hexdigest()
            == meta["sha256"]
        )


@pytest.mark.parametrize(
    "source",
    [
        "var x = function(){};",
        "var x = []; alert(1)",
        'var x = {a:"x",a:"y"};',
        "var x = [process.env];",
        "var x = " + "[" * 10 + '"x"' + "]" * 10,
    ],
)
def test_literal_parser_never_accepts_executable_or_unbounded_data(source):
    with pytest.raises(ValueError):
        literal_assignment(source, "x")


def test_real_partial_forecast_does_not_invent_observation_or_next_day_high():
    facts = source_facts()
    assert facts.observation is None
    assert facts.forecast.model_dump() == {
        "forecast_date": NOW.date(),
        "issued_at": NOW.replace(hour=18),
        "day_summary": None,
        "night_summary": "多云",
        "high_c": None,
        "low_c": None,
    }
    assert facts.valid_until == day_end(NOW.date())


@pytest.mark.parametrize(
    "old,new",
    [
        (b"2026-10-22 18:00", b"2026-10-21 18:00"),
        ("浙江".encode(), "江苏".encode()),
        (b"weather/101210101.shtml", b"weather/101210102.shtml"),
        ("22日夜间".encode(), "21日夜间".encode()),
    ],
)
def test_changed_official_structure_or_identity_fails_closed(old, new):
    with pytest.raises(InvalidWeatherSource):
        parse_weather(
            (FIXTURES / "hangzhou-2026-10-22.html").read_bytes().replace(old, new),
            hangzhou(),
            NOW,
        )


def test_future_issue_and_deep_html_are_invalid_source():
    with pytest.raises(InvalidWeatherSource):
        source_facts(now=NOW.replace(hour=17))
    with pytest.raises(InvalidWeatherSource):
        parse_weather(b"<div>" * 130 + b"x" + b"</div>" * 130, hangzhou(), NOW)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d["facts"]["forecast"].__setitem__("high_c", float("nan")),
        lambda d: d["facts"]["forecast"].__setitem__("low_c", float("inf")),
        lambda d: d["facts"]["forecast"].__setitem__(
            "issued_at", (NOW + timedelta(minutes=1)).isoformat()
        ),
        lambda d: d["facts"]["forecast"].__setitem__("forecast_date", "2026-10-23"),
        lambda d: d.__setitem__("missing_reason", "cache_busy"),
        lambda d: d["facts"].__setitem__("forecast", None),
    ],
)
def test_bad_cached_available_facts_are_not_accepted(mutate):
    data = CachedWeather(
        region_id=hangzhou().region_id,
        weather_date=NOW.date(),
        facts=source_facts(),
        missing_reason=None,
    ).model_dump(mode="json")
    mutate(data)
    with pytest.raises(ValidationError):
        CachedWeather.model_validate(data)


def test_cache_fault_bounded_once_and_source_failure_is_missing():
    class DownRedis:
        def get(self, key):
            raise RedisConnectionError("test offline")

    class Source:
        calls = 0

        def fetch(self, region, at):
            self.calls += 1
            return source_facts(region, at)

    source = Source()
    assert WeatherCache(DownRedis(), source, clock=lambda: NOW).get(hangzhou()).facts
    assert source.calls == 1

    class DownSource:
        def fetch(self, region, at):
            raise SourceUnavailable()

    assert (
        WeatherCache(DownRedis(), DownSource(), clock=lambda: NOW)
        .get(hangzhou())
        .missing_reason
        == "upstream_unavailable"
    )

    class BadSource:
        def fetch(self, region, at):
            return parse_weather(b"<div>" * 130, region, at)

    assert (
        WeatherCache(DownRedis(), BadSource(), clock=lambda: NOW)
        .get(hangzhou())
        .missing_reason
        == "invalid_source"
    )


def test_tencent_fixed_gcj02_boundary_and_single_address_component(monkeypatch):
    calls = []

    def get(url, timeout, max_bytes):
        calls.append((url, timeout, max_bytes))
        return json.dumps(
            {
                "status": 0,
                "result": {
                    "address_component": {
                        "province": "浙江省",
                        "city": "杭州市",
                        "district": "萧山区",
                    }
                },
            }
        ).encode()

    monkeypatch.setattr(weather_source, "bounded_get", get)
    location = FuzzyLocation(
        latitude=30.0, longitude=120.0, coordinate_system="gcj02", accuracy="fuzzy"
    )
    assert (
        TencentGeocoder("boundary-test-key", 3, 4096).reverse(location).district
        == "萧山区"
    )
    parts = urlsplit(calls[0][0])
    assert (parts.scheme, parts.netloc, parts.path) == (
        "https",
        "apis.map.qq.com",
        "/ws/geocoder/v1/",
    )
    assert parse_qs(parts.query) == {
        "key": ["boundary-test-key"],
        "location": ["30.0,120.0"],
        "get_poi": ["0"],
        "output": ["json"],
    }
    with pytest.raises(BusinessException) as error:
        TencentGeocoder(None, 3, 4096).reverse(location)
    assert error.value.code == 50371 and len(calls) == 1
    monkeypatch.setattr(
        weather_source,
        "bounded_get",
        lambda *args: b'{"status":0,"result":{"address_components":{}}}',
    )
    with pytest.raises(BusinessException):
        TencentGeocoder("key", 3, 4096).reverse(location)


@pytest.mark.parametrize(
    "payload",
    [
        {
            "latitude": True,
            "longitude": 120,
            "coordinate_system": "gcj02",
            "accuracy": "fuzzy",
        },
        {
            "latitude": 91,
            "longitude": 120,
            "coordinate_system": "gcj02",
            "accuracy": "fuzzy",
        },
        {
            "latitude": 30,
            "longitude": float("nan"),
            "coordinate_system": "gcj02",
            "accuracy": "fuzzy",
        },
        {
            "latitude": 30,
            "longitude": 120,
            "coordinate_system": "wgs84",
            "accuracy": "fuzzy",
        },
    ],
)
def test_location_contract_rejects_unsupported_or_nonfinite_coordinates(payload):
    with pytest.raises(ValidationError):
        FuzzyLocation.model_validate(payload)


def test_context_selection_contract():
    assert WeatherContextRequest().model_dump() == {"city_id": None, "location": None}
    with pytest.raises(ValidationError):
        WeatherContextRequest(
            city_id="cn-101210101",
            location={
                "latitude": 30,
                "longitude": 120,
                "coordinate_system": "gcj02",
                "accuracy": "fuzzy",
            },
        )


def test_optional_map_configuration_does_not_require_key():
    settings = Settings(
        _env_file=None,
        database_url="sqlite://",
        secret_key="boundary-only",
        tencent_map_key=" ",
    )
    assert settings.tencent_map_key is None
    assert (
        settings.weather_timeout_seconds == 5 and settings.weather_max_bytes == 524288
    )


def test_fixed_http_boundary_limits_body_timeout_redirect_and_retry(monkeypatch):
    calls = []

    class Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def read(self, size):
            assert size == 1025
            return b"x" * 1025

    class Opener:
        def open(self, request, timeout):
            calls.append((request.full_url, timeout))
            return Response()

    handlers = []

    def opener(handler):
        handlers.append(handler)
        return Opener()

    monkeypatch.setattr(weather_source, "build_opener", opener)
    with pytest.raises(SourceUnavailable):
        OfficialWeatherSource(2, 1024).fetch(hangzhou(), NOW)
    assert calls == [("https://www.weather.com.cn/weather1d/101210101.shtml", 2)]
    assert (
        handlers[0].redirect_request(
            None, None, 302, "redirect", {}, "https://other.test"
        )
        is None
    )


def test_http_redirect_and_timeout_are_bounded_source_failures(monkeypatch):
    calls = []

    class Redirect:
        def open(self, request, timeout):
            calls.append((request.full_url, timeout))
            raise HTTPError(request.full_url, 302, "redirect", {}, None)

    monkeypatch.setattr(weather_source, "build_opener", lambda handler: Redirect())
    with pytest.raises(SourceUnavailable):
        OfficialWeatherSource(2, 1024).fetch(hangzhou(), NOW)
    assert len(calls) == 1

    class TimedOut:
        def open(self, request, timeout):
            calls.append((request.full_url, timeout))
            raise TimeoutError("boundary timeout")

    monkeypatch.setattr(weather_source, "build_opener", lambda handler: TimedOut())
    with pytest.raises(SourceUnavailable):
        OfficialWeatherSource(2, 1024).fetch(hangzhou(), NOW)
    assert len(calls) == 2


def test_unknown_legacy_city_uses_explicit_default_without_rewriting_profile(profiles):
    db, owner, _ = profiles
    seed_regions(db)

    class DownCache:
        def get(self, key):
            raise RedisConnectionError("optional cache boundary")

    class Source:
        def fetch(self, region, at):
            assert not db.in_transaction()
            return source_facts(region, at)

    service = WeatherService(
        WeatherRepository(db),
        ProfileRepository(db),
        RegionService(RegionRepository(db), "test"),
        WeatherCache(DownCache(), Source(), clock=lambda: NOW),
        None,
        clock=lambda: NOW,
    )
    # Deliberately leave an authentication-like SELECT transaction for the service.
    assert (
        ProfileRepository(db).get_by_user_id(owner).city_id == "legacy-unverified-city"
    )
    assert db.in_transaction()
    result = service.create(owner, WeatherContextRequest())
    assert (
        result.selection_source == "default" and result.region.city_id == "cn-101210101"
    )
    assert (
        ProfileRepository(db).get_by_user_id(owner).city_id == "legacy-unverified-city"
    )


def test_verified_search_disambiguation_signed_pagination_and_hierarchy(db_session):
    seed_regions(db_session)
    service = RegionService(RegionRepository(db_session), "cursor-secret")
    matches = service.search("朝阳", None).items
    assert len(matches) == 9
    assert {(row.province, row.city) for row in matches if row.district == "朝阳"} == {
        ("北京", "北京"),
        ("吉林", "长春"),
        ("辽宁", "朝阳"),
    }
    normalized = service.search(" HangZhou ", None)
    assert normalized == service.search("hangzhou", None)
    assert "cn-101210101" in {row.region_id for row in normalized.items}
    first = service.search("广东", None)
    assert len(first.items) == 20 and first.next_cursor
    second = service.search("广东", first.next_cursor)
    assert not set(x.region_id for x in first.items) & set(
        x.region_id for x in second.items
    )
    for q, cursor in [("杭州", first.next_cursor), ("广东", first.next_cursor + "a")]:
        with pytest.raises(BusinessException) as error:
            service.search(q, cursor)
        assert error.value.code == 42272
    with pytest.raises(BusinessException) as error:
        service.search(
            "广东",
            service._encode(
                {"q": "广东", "v": "old", "after": first.items[-1].region_id}
            ),
        )
    assert error.value.code == 40970
    assert (
        service.resolve_hierarchy("浙江省", "杭州市", "萧山区").region_id
        == "cn-101210102"
    )
    with pytest.raises(BusinessException):
        service.resolve_hierarchy("辽宁省", "", "朝阳区")
    with pytest.raises(BusinessException):
        service.resolve_hierarchy("浙江省", "杭州市", "江干区")


def test_city_patch_preserves_others_rejects_unknown_and_rolls_back(profiles):
    db, owner, _ = profiles
    seed_regions(db)
    service = profile_service(db)
    saved = service.patch(
        owner, ProfilePatch(expected_version=1, city_id="cn-101210101")
    )
    assert (saved.city_id, saved.nickname, saved.version) == (
        "cn-101210101",
        "原昵称",
        2,
    )
    with pytest.raises(BusinessException) as error:
        service.patch(
            owner,
            ProfilePatch(expected_version=2, city_id="unknown", nickname="不能保存"),
        )
    assert error.value.code == 42270
    assert service.get_profile(owner).nickname == "原昵称"

    def fail(session):
        raise RuntimeError("injected city commit failure")

    event.listen(db, "before_commit", fail)
    try:
        with pytest.raises(RuntimeError):
            service.patch(
                owner,
                ProfilePatch(expected_version=2, city_id=None, nickname="不能保存"),
            )
    finally:
        event.remove(db, "before_commit", fail)
    row = service.get_profile(owner)
    assert (row.city_id, row.nickname, row.version) == ("cn-101210101", "原昵称", 2)
    assert (
        service.patch(owner, ProfilePatch(expected_version=2, city_id=None)).city_id
        is None
    )
