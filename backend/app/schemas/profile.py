from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator


class ProfilePatch(BaseModel):
    expected_version: int = Field(ge=1, strict=True)
    nickname: Annotated[str, StringConstraints(max_length=80)] | None = None
    avatar_media_id: UUID | None = None
    city_id: Annotated[str, StringConstraints(min_length=1, max_length=64)] | None = (
        None
    )
    model_config = ConfigDict(extra="forbid")

    @field_validator("nickname", mode="before")
    @classmethod
    def normalize_nickname(cls, value: object) -> object:
        return value.strip() or None if isinstance(value, str) else value


class ProfileResponse(BaseModel):
    user_id: int
    nickname: str | None
    avatar_media_id: UUID | None
    city_id: str | None
    version: int = Field(ge=1, strict=True)
    model_config = ConfigDict(from_attributes=True)
