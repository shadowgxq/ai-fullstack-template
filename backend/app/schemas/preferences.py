from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)

OptionId = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=40)]
Selection = Annotated[list[OptionId], Field(max_length=32)]
ComfortNotes = Annotated[str, StringConstraints(max_length=500)]


class _PreferenceFields(BaseModel):
    liked_styles: Selection
    avoided_styles: Selection
    liked_colors: Selection
    avoided_colors: Selection
    liked_occasions: Selection
    avoided_occasions: Selection
    comfort_notes: ComfortNotes | None

    @field_validator(
        "liked_styles",
        "avoided_styles",
        "liked_colors",
        "avoided_colors",
        "liked_occasions",
        "avoided_occasions",
    )
    @classmethod
    def canonical_selection(cls, value: list[str]) -> list[str]:
        return sorted(set(value))

    @field_validator("avoided_styles", "avoided_colors", "avoided_occasions")
    @classmethod
    def reject_overlap(cls, value: list[str], info: ValidationInfo) -> list[str]:
        liked_field = info.field_name.replace("avoided_", "liked_")
        if set(value) & set(info.data.get(liked_field, [])):
            raise ValueError("Liked and avoided options must not overlap")
        return value

    @field_validator("comfort_notes", mode="before")
    @classmethod
    def normalize_comfort_notes(cls, value: object) -> object:
        return value.strip() or None if isinstance(value, str) else value


class PreferencesPut(_PreferenceFields):
    expected_version: int = Field(ge=0, strict=True)
    model_config = ConfigDict(extra="forbid")


class PreferencesView(_PreferenceFields):
    version: int = Field(ge=0, strict=True)
    catalog_version: str
