from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.garment import GarmentView

Scene = Literal["any", "work", "daily", "date"]
RecommendationStatus = Literal[
    "dispatch_pending", "generating", "ready", "failed", "cancelled", "stale"
]
SelectedIds = Annotated[list[UUID], Field(min_length=1, max_length=64)]


class RecommendationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scene: Scene = "any"
    weather_context_id: UUID | None = None


class RecommendationSelectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    selected_ids: SelectedIds

    @field_validator("selected_ids")
    @classmethod
    def unique_ids(cls, value: list[UUID]) -> list[UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Selected garments must be unique")
        return value


class RecommendationSelection(BaseModel):
    request_id: UUID
    selected_ids: list[UUID]
    garments: list[GarmentView]
    reasons: list[str]
    limitations: list[str]


class RecommendationView(BaseModel):
    request_id: UUID
    status: RecommendationStatus
    scene: Scene
    outcome: Literal["recommendation", "no_inventory", "no_candidates"] | None
    error_code: str | None
    inventory_count: int = Field(ge=0)
    eligible_count: int = Field(ge=0)
    candidate_scope_limited: bool
    limitations: list[str]
    result: RecommendationSelection | None
    created_at: datetime
    deadline_at: datetime


class RecommendationCandidates(BaseModel):
    items: list[GarmentView]
    next_cursor: str | None
