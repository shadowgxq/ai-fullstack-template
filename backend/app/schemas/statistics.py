from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.garment import GarmentStatus


class CategoryCount(BaseModel):
    category: str | None
    count: int = Field(ge=0)


class DailyWearCount(BaseModel):
    date: date
    count: int = Field(ge=0)


class WearTrend(BaseModel):
    start_date: date
    end_date: date
    timezone: Literal["Asia/Shanghai"] = "Asia/Shanghai"
    days: list[DailyWearCount] = Field(min_length=30, max_length=30)


class GarmentWearCount(BaseModel):
    garment_id: UUID
    name: str | None
    category: str | None
    status: GarmentStatus
    wear_count: int = Field(ge=0)


class GarmentCountsPage(BaseModel):
    items: list[GarmentWearCount] = Field(max_length=100)
    next_cursor: str | None


class StatisticsView(BaseModel):
    wardrobe_total: int = Field(ge=0)
    wearable_count: int | None = Field(default=None, ge=0)
    unavailable_count: int | None = Field(default=None, ge=0)
    archived_count: int = Field(ge=0)
    category_counts: list[CategoryCount]
    wear_record_count: int = Field(ge=0)
    trend: WearTrend
    garment_counts: GarmentCountsPage
