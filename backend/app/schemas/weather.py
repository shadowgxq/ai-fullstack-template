from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    model_validator,
)

CityId = Annotated[str, StringConstraints(min_length=1, max_length=64)]
WeatherMissingReason = Literal[
    "upstream_unavailable", "invalid_source", "cache_busy", "lock_lost", "day_changed"
]


class RegionView(BaseModel):
    city_id: str
    region_id: str
    weather_code: str
    province: str
    city: str
    district: str
    display_name: str
    mapping_version: str


class CityList(BaseModel):
    items: list[RegionView]
    next_cursor: str | None
    mapping_version: str


class FuzzyLocation(BaseModel):
    latitude: float = Field(ge=-90, le=90, strict=True, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, strict=True, allow_inf_nan=False)
    coordinate_system: Literal["gcj02"]
    accuracy: Literal["fuzzy"]
    model_config = ConfigDict(extra="forbid")


class WeatherContextRequest(BaseModel):
    city_id: CityId | None = None
    location: FuzzyLocation | None = None
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def exclusive_selection(self) -> "WeatherContextRequest":
        if self.city_id is not None and self.location is not None:
            raise ValueError("city_id and location are mutually exclusive")
        return self


class WeatherObservation(BaseModel):
    observed_at: AwareDatetime
    temperature_c: float = Field(ge=-100, le=80, allow_inf_nan=False)


class WeatherForecast(BaseModel):
    forecast_date: date
    issued_at: AwareDatetime
    day_summary: str | None
    night_summary: str | None
    high_c: float | None = Field(ge=-100, le=80, allow_inf_nan=False)
    low_c: float | None = Field(ge=-100, le=80, allow_inf_nan=False)


class WeatherFacts(BaseModel):
    source: Literal["weather.com.cn"]
    parser_version: Literal["weather1d.v1"]
    fetched_at: AwareDatetime
    valid_until: AwareDatetime
    observation: WeatherObservation | None
    forecast: WeatherForecast | None


class WeatherContextView(BaseModel):
    context_id: UUID
    region: RegionView
    selection_source: Literal["selected", "saved", "default", "location"]
    weather_date: date
    valid_until: AwareDatetime
    state: Literal["available", "missing"]
    facts: WeatherFacts | None
    missing_reason: WeatherMissingReason | None

    @model_validator(mode="after")
    def consistent_state(self) -> "WeatherContextView":
        if self.state == "available":
            if (
                self.facts is None
                or self.missing_reason is not None
                or (self.facts.observation is None and self.facts.forecast is None)
            ):
                raise ValueError("Available weather requires supported facts")
        elif self.facts is not None or self.missing_reason is None:
            raise ValueError("Missing weather requires an explicit reason and no facts")
        return self
