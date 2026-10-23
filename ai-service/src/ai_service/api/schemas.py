"""Public DTOs are distinct from persistence and LangGraph state."""

import json
from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Id = Annotated[
    str,
    StringConstraints(
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    ),
]
Short = Annotated[str, StringConstraints(min_length=1, max_length=40)]
FactId = Annotated[
    str, StringConstraints(min_length=1, max_length=80, pattern=r"^[a-zA-Z0-9_.:-]+$")
]
Day = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]


class StrictDTO(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)

    @model_validator(mode="before")
    @classmethod
    def persistable_unicode(cls, value):
        """Reject unsupported PostgreSQL/UTF-8 text rather than cleaning frozen input."""

        def check(item):
            if isinstance(item, str):
                if "\x00" in item:
                    raise ValueError("NUL is not valid persisted text")
                try:
                    item.encode("utf-8")
                except UnicodeEncodeError:
                    raise ValueError("Text must be valid UTF-8") from None
            elif isinstance(item, dict):
                for key, child in item.items():
                    check(key)
                    check(child)
            elif isinstance(item, (list, tuple)):
                for child in item:
                    check(child)

        check(value)
        return value


class Candidate(StrictDTO):
    id: Id
    name: Annotated[str, StringConstraints(max_length=120)] | None
    category: Short | None
    color: Short | None
    season: list[Short] = Field(max_length=4)
    occasion: list[Short] = Field(max_length=20)
    tags: list[Short] = Field(max_length=32)


class Preferences(StrictDTO):
    liked_styles: list[Short] = Field(max_length=32)
    avoided_styles: list[Short] = Field(max_length=32)
    liked_colors: list[Short] = Field(max_length=32)
    avoided_colors: list[Short] = Field(max_length=32)
    liked_occasions: list[Short] = Field(max_length=32)
    avoided_occasions: list[Short] = Field(max_length=32)
    comfort_notes: Annotated[str, StringConstraints(max_length=500)] | None

    @model_validator(mode="after")
    def distinct_constraints(self):
        for kind in ("styles", "colors", "occasions"):
            liked, avoided = (
                getattr(self, "liked_" + kind),
                getattr(self, "avoided_" + kind),
            )
            if (
                len(set(liked)) != len(liked)
                or len(set(avoided)) != len(avoided)
                or set(liked) & set(avoided)
            ):
                raise ValueError("Preference values must be unique and disjoint")
        return self


class GarmentHistory(StrictDTO):
    garment_id: Id
    wear_count: int = Field(ge=0)
    last_worn_on: Day | None


class HistorySummary(StrictDTO):
    start_date: Day
    end_date: Day
    garments: list[GarmentHistory] = Field(max_length=256)

    @model_validator(mode="after")
    def valid_range(self):
        start, end = (
            date.fromisoformat(self.start_date),
            date.fromisoformat(self.end_date),
        )
        if not 0 <= (end - start).days <= 29:
            raise ValueError("History must cover at most 30 inclusive days")
        ids = [item.garment_id for item in self.garments]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate garment history")
        for item in self.garments:
            if (
                item.last_worn_on is not None
                and not start <= date.fromisoformat(item.last_worn_on) <= end
            ):
                raise ValueError("History date outside frozen range")
        return self


class Observation(StrictDTO):
    observed_at: AwareDatetime = Field(strict=False)
    temperature_c: float = Field(ge=-100, le=80)

    @field_validator("observed_at", mode="before")
    @classmethod
    def timestamp_only(cls, value):
        if not isinstance(value, (str, datetime)):
            raise ValueError("ISO timestamp required")
        return value


class Forecast(StrictDTO):
    forecast_date: Day
    issued_at: AwareDatetime = Field(strict=False)
    day_summary: Annotated[str, StringConstraints(min_length=1, max_length=80)] | None
    night_summary: Annotated[str, StringConstraints(min_length=1, max_length=80)] | None
    high_c: float | None = Field(ge=-100, le=80)
    low_c: float | None = Field(ge=-100, le=80)

    @field_validator("issued_at", mode="before")
    @classmethod
    def timestamp_only(cls, value):
        return Observation.timestamp_only(value)


class WeatherFacts(StrictDTO):
    source: Literal["weather.com.cn"]
    parser_version: Literal["weather1d.v1"]
    fetched_at: AwareDatetime = Field(strict=False)
    valid_until: AwareDatetime = Field(strict=False)
    observation: Observation | None
    forecast: Forecast | None

    @field_validator("fetched_at", "valid_until", mode="before")
    @classmethod
    def timestamp_only(cls, value):
        return Observation.timestamp_only(value)


class WeatherInput(StrictDTO):
    state: Literal["available", "missing"]
    context_id: Id | None
    region_id: Annotated[str, StringConstraints(min_length=1, max_length=64)] | None
    weather_date: Day
    facts: WeatherFacts | None
    missing_reason: Short | None

    @model_validator(mode="after")
    def supported_facts(self):
        from datetime import timedelta
        from zoneinfo import ZoneInfo

        day = date.fromisoformat(self.weather_date)
        if self.state == "missing":
            if self.facts is not None or self.missing_reason is None:
                raise ValueError("Missing weather requires a reason")
            return self
        facts = self.facts
        if (
            facts is None
            or self.missing_reason is not None
            or self.region_id is None
            or (facts.observation is None and facts.forecast is None)
        ):
            raise ValueError("Available weather requires dated facts")
        zone = ZoneInfo("Asia/Shanghai")
        if facts.fetched_at.astimezone(
            zone
        ).date() != day or facts.valid_until.astimezone(zone) != datetime.combine(
            day + timedelta(days=1), datetime.min.time(), zone
        ):
            raise ValueError("Invalid weather day")
        if facts.observation and (
            facts.observation.observed_at > facts.fetched_at
            or facts.observation.observed_at.astimezone(zone).date() != day
        ):
            raise ValueError("Invalid observation time")
        forecast = facts.forecast
        if forecast and (
            date.fromisoformat(forecast.forecast_date) != day
            or forecast.issued_at > facts.fetched_at
            or forecast.issued_at.astimezone(zone).date() != day
            or not any(
                (
                    forecast.day_summary,
                    forecast.night_summary,
                    forecast.high_c is not None,
                    forecast.low_c is not None,
                )
            )
        ):
            raise ValueError("Invalid forecast time or facts")
        return self


class Revisions(StrictDTO):
    inventory_revision: int = Field(ge=0)
    history_revision: int = Field(ge=0)
    preferences_revision: int = Field(ge=0)


class Versions(StrictDTO):
    catalog_version: Literal["1"]
    policy_version: Literal["wardrobe.filter.v1"]
    prompt_version: Literal["wardrobe.recommend.prompt.v1"]
    schema_version: Literal["wardrobe.recommend.output.v1"]


class FactAtom(StrictDTO):
    ref_id: FactId
    kind: Literal["garment", "preference", "history", "weather"]
    subject_id: Id | None
    field: Literal[
        "name",
        "category",
        "color",
        "style",
        "season",
        "occasion",
        "tag",
        "liked_style",
        "liked_color",
        "liked_occasion",
        "wear_count",
        "last_worn_on",
        "observation_temperature_c",
        "forecast_high_c",
        "forecast_low_c",
        "forecast_day_summary",
        "forecast_night_summary",
    ]
    value: Annotated[str, StringConstraints(max_length=200)] | int | float

    @model_validator(mode="after")
    def allowed_field(self):
        allowed = {
            "garment": {
                "name",
                "category",
                "color",
                "style",
                "season",
                "occasion",
                "tag",
            },
            "preference": {"liked_style", "liked_color", "liked_occasion"},
            "history": {"wear_count", "last_worn_on"},
            "weather": {
                "observation_temperature_c",
                "forecast_high_c",
                "forecast_low_c",
                "forecast_day_summary",
                "forecast_night_summary",
            },
        }
        if self.field not in allowed[self.kind]:
            raise ValueError("Unsupported fact kind/field")
        if self.kind in {"garment", "history"} and self.subject_id is None:
            raise ValueError("Garment fact requires a subject")
        return self


class WardrobeInput(StrictDTO):
    candidates: list[Candidate] = Field(min_length=1, max_length=256)
    preferences: Preferences
    scene: Literal["any", "work", "daily", "date"]
    history: HistorySummary
    weather: WeatherInput
    revisions: Revisions
    versions: Versions
    fact_refs: list[FactAtom] = Field(max_length=256)
    candidate_scope_limited: bool

    @model_validator(mode="after")
    def unique_members_and_capacity(self):
        ids = [item.id for item in self.candidates]
        refs = [item.ref_id for item in self.fact_refs]
        if len(ids) != len(set(ids)) or len(refs) != len(set(refs)):
            raise ValueError("Duplicate candidate/fact identity")
        if any(item.garment_id not in ids for item in self.history.garments) or any(
            item.subject_id is not None and item.subject_id not in ids
            for item in self.fact_refs
        ):
            raise ValueError("Unknown input subject")
        if (
            len(
                json.dumps(
                    self.model_dump(mode="json"), ensure_ascii=False, allow_nan=False
                ).encode()
            )
            > 512 * 1024
        ):
            raise ValueError("Frozen input exceeds 512 KiB")
        return self


ReasonCode = Literal[
    "known_attributes",
    "liked_style",
    "liked_color",
    "liked_occasion",
    "scene_reference",
    "weather_reference",
    "history_reference",
]
TradeoffCode = Literal[
    "partial_outfit",
    "unknown_attributes",
    "weather_missing",
    "history_empty",
    "comfort_reference_only",
    "candidate_scope_limited",
]


class RecommendationChoice(StrictDTO):
    selected_ids: list[Id] = Field(min_length=1, max_length=64)
    reason_codes: list[ReasonCode] = Field(max_length=32)
    fact_refs: list[FactId] = Field(max_length=128)
    tradeoff_codes: list[TradeoffCode] = Field(max_length=32)

    @model_validator(mode="after")
    def no_duplicate_values(self):
        for value in self.model_dump().values():
            if len(value) != len(set(value)):
                raise ValueError("Output values must be unique")
        return self


class Usage(StrictDTO):
    input_tokens: int | None = Field(ge=0)
    output_tokens: int | None = Field(ge=0)
    total_tokens: int | None = Field(ge=0)


class CallEvidence(StrictDTO):
    operation_id: Id
    response_ref: Id
    adapter: Literal["openai.responses.v1"]
    requested_model: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    returned_model: (
        Annotated[str, StringConstraints(min_length=1, max_length=128)] | None
    )
    request_id: Annotated[str, StringConstraints(min_length=1, max_length=200)] | None
    usage: Usage | None
    prompt_version: Literal["wardrobe.recommend.prompt.v1"]
    schema_version: Literal["wardrobe.recommend.output.v1"]


class RecommendationOutput(RecommendationChoice):
    call_evidence: CallEvidence


class EchoInput(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    model_config = ConfigDict(extra="forbid", strict=True)


class CreateRun(BaseModel):
    workflow: Literal["echo.v1", "wardrobe.recommend.v1"] = "echo.v1"
    input: EchoInput | WardrobeInput
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def matching_workflow(self):
        if (self.workflow == "echo.v1") != isinstance(self.input, EchoInput):
            raise ValueError("Workflow input does not match its version")
        return self


class RunView(BaseModel):
    run_id: UUID
    workflow: str
    status: Literal["queued", "running", "completed", "failed", "cancelled"]
    input: EchoInput | WardrobeInput
    output: EchoInput | RecommendationOutput | None
    error_code: str | None
    last_sequence: int
    created_at: datetime
    cancel_requested: bool


class EventView(BaseModel):
    sequence: int
    event_type: Literal[
        "queued", "running", "completed", "failed", "cancel_requested", "cancelled"
    ]
    payload: dict[str, str]
