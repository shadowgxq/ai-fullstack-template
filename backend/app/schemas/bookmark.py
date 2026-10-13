"""Bookmark input normalization and public DTOs."""

import ipaddress
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.response import Paginated

OperationKind = Literal[
    "bookmark_create",
    "bookmark_update",
    "bookmark_delete",
    "group_create",
    "group_rename",
    "group_delete",
    "batch_move",
]
OperationStatus = Literal["succeeded", "failed", "not_executed"]


def validate_storable_text(value: str) -> str:
    # PostgreSQL text/varchar cannot store NUL. Reject at the field boundary
    # instead of turning a valid-looking draft into an uncertain write failure.
    if "\x00" in value:
        raise ValueError("Text must not contain NUL characters")
    return value


def _ipv4_number(value: str) -> int:
    if not value:
        raise ValueError
    radix = 10
    digits = "0123456789"
    if value[:2].lower() == "0x":
        value, radix, digits = value[2:], 16, "0123456789abcdef"
    elif len(value) >= 2 and value[0] == "0":
        value, radix, digits = value[1:], 8, "01234567"
    if any(char.lower() not in digits for char in value):
        raise ValueError
    return int(value, radix) if value else 0


def _validate_numeric_host(labels: list[str]) -> None:
    # HTTP(S) hosts ending in a number use WHATWG IPv4 parsing, including
    # hex/octal and abbreviated forms, rather than ordinary domain labels.
    # https://url.spec.whatwg.org/#concept-ipv4-parser
    try:
        _ipv4_number(labels[-1])
    except ValueError:
        if not labels[-1].isdigit():
            return
    if len(labels) > 4:
        raise ValueError
    numbers = [_ipv4_number(label) for label in labels]
    if any(number > 255 for number in numbers[:-1]) or numbers[-1] >= 256 ** (
        5 - len(numbers)
    ):
        raise ValueError


class BookmarkWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=80, strict=True)
    url: str = Field(min_length=1, max_length=2048, strict=True)
    group_id: UUID | None = None
    note: str = Field(default="", max_length=500, strict=True)

    @field_validator("title", "url", mode="before")
    @classmethod
    def trim_required(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("title", "note")
    @classmethod
    def validate_text_storage(cls, value: str) -> str:
        return validate_storable_text(value)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        if any(ord(char) < 32 or ord(char) == 127 for char in value):
            raise ValueError("URL must not contain control characters")
        try:
            parts = urlsplit(value)
            host = parts.hostname
            port = parts.port
            if parts.scheme.lower() not in ("http", "https") or not host:
                raise ValueError
            if any(char.isspace() for char in value) or "\\" in value:
                raise ValueError
            if ":" in host:
                ipaddress.IPv6Address(host)
            else:
                labels = (
                    host.encode("idna").decode("ascii").removesuffix(".").split(".")
                )
                if len(host) > 253 or any(
                    not label
                    or len(label) > 63
                    or label[0] == "-"
                    or label[-1] == "-"
                    or not all(char.isalnum() or char == "-" for char in label)
                    for label in labels
                ):
                    raise ValueError
                _validate_numeric_host(labels)
            if port is not None and not 0 < port <= 65535:
                raise ValueError
        except (ValueError, UnicodeError):
            raise ValueError(
                "URL must be an absolute HTTP or HTTPS address with a valid host"
            ) from None
        return value


class BookmarkBatchMove(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bookmark_ids: list[UUID] = Field(min_length=1, max_length=10)
    target_group_id: UUID | None

    @field_validator("bookmark_ids")
    @classmethod
    def distinct_ids(cls, value: list[UUID]) -> list[UUID]:
        if len(set(value)) != len(value):
            raise ValueError("Bookmark IDs must be distinct")
        return value


class BookmarkResponse(BaseModel):
    id: UUID
    title: str
    url: str
    note: str
    group_id: UUID | None
    updated_at: datetime

    @field_validator("updated_at")
    @classmethod
    def utc_timestamp(cls, value: datetime) -> datetime:
        # SQLite drops timezone information; PostgreSQL stores timestamptz.
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


class BookmarkGroupWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=30, strict=True)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        validate_storable_text(value)
        if value in {"全部", "未分组"}:
            raise ValueError("Group name is reserved")
        return value


class BookmarkGroupSummary(BaseModel):
    id: UUID
    name: str
    count: int


class BookmarkListResponse(Paginated[BookmarkResponse]):
    groups: list[BookmarkGroupSummary]
    all_count: int
    ungrouped_count: int


class MutationResult(BaseModel):
    operation_id: UUID
    kind: OperationKind
    resource_id: UUID | None
    changed_count: int


class OperationResult(BaseModel):
    operation_id: UUID
    status: OperationStatus
    kind: OperationKind | None
    resource_id: UUID | None
    changed_count: int
    error_code: int | None
