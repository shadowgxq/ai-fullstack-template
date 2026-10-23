"""Public daily facts only. Lua fences both lock ownership and Shanghai day."""

from datetime import date, timedelta
import time
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, ValidationError, model_validator
from redis.exceptions import RedisError

from app.schemas.weather import RegionView, WeatherFacts, WeatherMissingReason
from app.services.weather_source import InvalidWeatherSource, SourceUnavailable
from app.services.weather_time import SHANGHAI, day_end, day_start, now_shanghai

PUBLISH = """
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
local now = tonumber(redis.call('TIME')[1])
if now < tonumber(ARGV[2]) or now >= tonumber(ARGV[3]) then
  redis.call('DEL', KEYS[2]); return -1
end
redis.call('SET', KEYS[1], ARGV[4])
redis.call('EXPIREAT', KEYS[1], tonumber(ARGV[5]))
redis.call('DEL', KEYS[2]); return 1
"""
RELEASE = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end"


class CachedWeather(BaseModel):
    region_id: str
    weather_date: date
    facts: WeatherFacts | None
    missing_reason: WeatherMissingReason | None
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def consistent(self):
        if (self.facts is None) == (self.missing_reason is None):
            raise ValueError("Facts and missing reason must be exclusive")
        facts = self.facts
        if facts is not None:
            if facts.fetched_at.astimezone(
                SHANGHAI
            ).date() != self.weather_date or facts.valid_until != day_end(
                self.weather_date
            ):
                raise ValueError("Invalid fact date")
            if facts.observation is None and facts.forecast is None:
                raise ValueError("No supported facts")
            if facts.observation is not None and (
                facts.observation.observed_at > facts.fetched_at
                or facts.observation.observed_at.astimezone(SHANGHAI).date()
                != self.weather_date
            ):
                raise ValueError("Invalid observation time")
            forecast = facts.forecast
            if forecast is not None and (
                forecast.forecast_date != self.weather_date
                or forecast.issued_at > facts.fetched_at
                or forecast.issued_at.astimezone(SHANGHAI).date() != self.weather_date
                or not any(
                    (
                        forecast.day_summary,
                        forecast.night_summary,
                        forecast.high_c is not None,
                        forecast.low_c is not None,
                    )
                )
                or (
                    forecast.high_c is not None
                    and forecast.low_c is not None
                    and forecast.low_c > forecast.high_c
                )
            ):
                raise ValueError("Invalid forecast")
        return self


class WeatherCache:
    def __init__(
        self,
        redis,
        source,
        *,
        clock=now_shanghai,
        sleep=time.sleep,
        prefix="weather:v1:",
        wait_attempts=10,
        wait_seconds=0.1,
    ):
        self.redis, self.source, self.clock, self.sleep = redis, source, clock, sleep
        self.prefix, self.wait_attempts, self.wait_seconds = (
            prefix,
            wait_attempts,
            wait_seconds,
        )

    def key(self, region: RegionView, day: date) -> str:
        return (
            f"{self.prefix}weather.com.cn:weather1d.v1:{region.region_id}:{day:%Y%m%d}"
        )

    def _read(self, key: str, region: RegionView, day: date) -> CachedWeather | None:
        raw = self.redis.get(key)
        if raw is None:
            return None
        try:
            value = CachedWeather.model_validate_json(raw)
            now = self.clock()
            if (
                value.region_id != region.region_id
                or value.weather_date != day
                or now.astimezone(SHANGHAI).date() != day
            ):
                return None
            if value.facts and (
                value.facts.fetched_at > now or value.facts.valid_until <= now
            ):
                return None
            return value
        except (ValidationError, ValueError, TypeError):
            return None

    def _missing(self, region, day, reason):
        return CachedWeather(
            region_id=region.region_id,
            weather_date=day,
            facts=None,
            missing_reason=reason,
        )

    def _fetch(self, region: RegionView, day: date) -> CachedWeather:
        try:
            facts = self.source.fetch(region, self.clock())
            value = CachedWeather(
                region_id=region.region_id,
                weather_date=day,
                facts=facts,
                missing_reason=None,
            )
            if value.facts.fetched_at > self.clock():
                raise InvalidWeatherSource()
        except (InvalidWeatherSource, ValidationError):
            value = self._missing(region, day, "invalid_source")
        except SourceUnavailable:
            value = self._missing(region, day, "upstream_unavailable")
        if self.clock().astimezone(SHANGHAI).date() != day:
            return self._missing(region, day, "day_changed")
        return value

    def get(self, region: RegionView) -> CachedWeather:
        day = self.clock().astimezone(SHANGHAI).date()
        key, token = self.key(region, day), f"{day}:{uuid4().hex}"
        lock = key + ":lock"
        try:
            cached = self._read(key, region, day)
            if cached is not None:
                return cached
            acquired = self.redis.set(lock, token, nx=True, ex=15)
        except RedisError:
            return self._fetch(region, day)
        if not acquired:
            for _ in range(self.wait_attempts):
                self.sleep(self.wait_seconds)
                if self.clock().astimezone(SHANGHAI).date() != day:
                    return self._missing(region, day, "day_changed")
                try:
                    cached = self._read(key, region, day)
                except RedisError:
                    return self._missing(region, day, "cache_busy")
                if cached is not None:
                    return cached
            return self._missing(region, day, "cache_busy")
        try:
            # A predecessor may have published between initial GET and acquisition.
            try:
                cached = self._read(key, region, day)
            except RedisError:
                cached = None
            if cached is not None:
                return cached
            value = self._fetch(region, day)
            if value.missing_reason == "day_changed":
                return value
            expires = (
                day_start(day + timedelta(days=7)).timestamp()
                if value.facts
                else min(self.clock().timestamp() + 60, day_end(day).timestamp())
            )
            try:
                published = self.redis.eval(
                    PUBLISH,
                    2,
                    key,
                    lock,
                    token,
                    int(day_start(day).timestamp()),
                    int(day_end(day).timestamp()),
                    value.model_dump_json(),
                    int(expires),
                )
                if published == -1:
                    return self._missing(region, day, "day_changed")
                if published == 0:
                    winner = self._read(key, region, day)
                    return winner or self._missing(region, day, "lock_lost")
            except RedisError:
                # A successful bounded fetch remains usable when only cache storage fails.
                return value
            return value
        finally:
            try:
                self.redis.eval(RELEASE, 1, lock, token)
            except RedisError:
                pass
