from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

MediaPurpose = Literal["garment", "avatar"]


class MediaResponse(BaseModel):
    id: UUID
    purpose: MediaPurpose
    status: Literal["ready"]
    content_type: str
    size_bytes: int
    width: int
    height: int
    model_config = ConfigDict(from_attributes=True)
