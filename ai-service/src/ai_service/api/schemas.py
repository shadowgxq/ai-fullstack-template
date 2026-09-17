"""Public DTOs are distinct from persistence and LangGraph state."""
from datetime import datetime
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class EchoInput(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    model_config = ConfigDict(extra="forbid", strict=True)

class CreateRun(BaseModel):
    workflow: Literal["echo.v1"] = "echo.v1"
    input: EchoInput
    model_config = ConfigDict(extra="forbid")

class RunView(BaseModel):
    run_id: UUID
    workflow: str
    status: Literal["queued", "running", "completed", "failed"]
    input: EchoInput
    output: EchoInput | None
    error_code: str | None
    last_sequence: int
    created_at: datetime

class EventView(BaseModel):
    sequence: int
    event_type: Literal["queued", "running", "completed", "failed"]
    payload: dict[str, str]
