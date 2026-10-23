from datetime import datetime, timezone
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)
from pydantic.json_schema import SkipJsonSchema

GarmentStatus = Literal["wearable", "unavailable", "archived"]
ShortValue = Annotated[str, StringConstraints(min_length=1, max_length=40)]
Name = Annotated[str, StringConstraints(max_length=120)]
Notes = Annotated[str, StringConstraints(max_length=2000)]


class _GarmentFields(BaseModel):
    name: Name | None = None
    photo_media_id: UUID | None = None
    category: ShortValue | None = None
    color: ShortValue | None = None
    season: list[ShortValue] = Field(default_factory=list, max_length=4)
    occasion: list[ShortValue] = Field(default_factory=list, max_length=20)
    tags: list[ShortValue] = Field(default_factory=list, max_length=32)
    notes: Notes | None = None
    model_config = ConfigDict(extra="forbid")

    @field_validator("name", "notes", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: object) -> object:
        return value.strip() or None if isinstance(value, str) else value

    @field_validator("season", "occasion", "tags", mode="before")
    @classmethod
    def normalize_selections(cls, value: object) -> object:
        if not isinstance(value, list) or not all(
            isinstance(item, str) for item in value
        ):
            return value
        return list(dict.fromkeys(item.strip() for item in value if item.strip()))


class GarmentCreate(_GarmentFields):
    pass


class GarmentPatch(_GarmentFields):
    expected_version: int = Field(ge=1, strict=True)
    # None 只标识字段缺失；显式 null 被拒绝，公开 schema 同样排除 null。
    status: GarmentStatus | SkipJsonSchema[None] = None

    @model_validator(mode="after")
    def reject_null_status(self) -> "GarmentPatch":
        if "status" in self.model_fields_set and self.status is None:
            raise ValueError("Status cannot be null")
        return self


class GarmentCreated(BaseModel):
    id: UUID
    version: int


class GarmentView(_GarmentFields):
    id: UUID
    status: GarmentStatus
    version: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at", "updated_at")
    @classmethod
    def as_utc(cls, value: datetime) -> datetime:
        # SQLite 单测不保存 offset；生产 PostgreSQL 已返回带时区时间。
        return (
            value.replace(tzinfo=timezone.utc)
            if value.tzinfo is None
            else value.astimezone(timezone.utc)
        )


class GarmentList(BaseModel):
    items: list[GarmentView]
    next_cursor: str | None


class GarmentDetail(GarmentView):
    wear_count: int = Field(ge=0)


class CatalogOption(BaseModel):
    id: str
    label: str


class WardrobeOptions(BaseModel):
    version: str
    categories: list[CatalogOption]
    colors: list[CatalogOption]
    seasons: list[CatalogOption]
    occasions: list[CatalogOption]
    styles: list[CatalogOption]
