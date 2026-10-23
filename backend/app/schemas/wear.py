from datetime import date, datetime, timezone
import re
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from pydantic.json_schema import SkipJsonSchema

GarmentIds = Annotated[list[UUID], Field(min_length=1, max_length=1000)]


def _iso_date(value: object) -> date:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return date.fromisoformat(value)
    raise ValueError("Wear date must be an ISO date")


IsoDate = Annotated[date, BeforeValidator(_iso_date)]


class _WearFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("garment_ids", check_fields=False)
    @classmethod
    def canonical_ids(cls, value: list[UUID] | None) -> list[UUID] | None:
        return sorted(set(value)) if value is not None else None


class WearCreate(_WearFields):
    wear_date: IsoDate
    garment_ids: GarmentIds
    recommendation_request_id: UUID | None = None


class WearPatch(_WearFields):
    expected_version: int = Field(ge=1, strict=True)
    wear_date: IsoDate | SkipJsonSchema[None] = None
    garment_ids: GarmentIds | SkipJsonSchema[None] = None

    @model_validator(mode="after")
    def reject_explicit_null(self) -> "WearPatch":
        for field in ("wear_date", "garment_ids"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self


class WearCreated(BaseModel):
    id: UUID
    version: int


class WearItem(BaseModel):
    garment_id: UUID
    name_snapshot: str | None
    category_snapshot: str | None
    model_config = ConfigDict(from_attributes=True)


class WearView(BaseModel):
    id: UUID
    wear_date: date
    version: int
    created_at: datetime
    updated_at: datetime
    items: list[WearItem]
    recommendation_request_id: UUID | None = None

    @field_validator("created_at", "updated_at")
    @classmethod
    def as_utc(cls, value: datetime) -> datetime:
        return (
            value.replace(tzinfo=timezone.utc)
            if value.tzinfo is None
            else value.astimezone(timezone.utc)
        )


class WearList(BaseModel):
    items: list[WearView]
    next_cursor: str | None


class WearDeleted(BaseModel):
    id: UUID
    deleted: Literal[True] = True


class GarmentHistorySummary(BaseModel):
    garment_id: UUID
    wear_count: int
    last_wear_date: date


class HistorySummary(BaseModel):
    start_date: date
    end_date: date
    timezone: Literal["Asia/Shanghai"] = "Asia/Shanghai"
    record_count: int
    garments: list[GarmentHistorySummary]
