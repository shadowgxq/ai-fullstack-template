import base64
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
import hashlib
import hmac
import json
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.core.exceptions import BusinessException
from app.repositories.statistics_repository import StatisticsRepository
from app.schemas.statistics import (
    CategoryCount,
    DailyWearCount,
    GarmentCountsPage,
    GarmentWearCount,
    StatisticsView,
    WearTrend,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class _GarmentCursor(BaseModel):
    owner_id: int = Field(ge=1, strict=True)
    statistics_date: date
    inventory_revision: int = Field(ge=0, strict=True)
    history_revision: int = Field(ge=0, strict=True)
    wear_count: int = Field(ge=0, strict=True)
    garment_id: UUID
    model_config = ConfigDict(extra="forbid")


class StatisticsService:
    def __init__(
        self,
        repo: StatisticsRepository,
        cursor_secret: str,
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self.repo = repo
        self.cursor_secret = cursor_secret.encode()
        self.clock = clock

    def _signature(self, encoded: str) -> str:
        return hmac.new(
            self.cursor_secret,
            b"statistics.garment_counts:" + encoded.encode(),
            hashlib.sha256,
        ).hexdigest()

    def _decode_cursor(self, owner_id: int, value: str) -> _GarmentCursor:
        try:
            encoded, signature = value.split(".")
            if not hmac.compare_digest(signature, self._signature(encoded)):
                raise ValueError("Invalid signature")
            payload = _GarmentCursor.model_validate(
                json.loads(
                    base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
                )
            )
            if payload.owner_id != owner_id:
                raise ValueError("Cursor owner changed")
            return payload
        except (ValueError, TypeError, UnicodeDecodeError, ValidationError):
            raise BusinessException(42240, "Invalid statistics cursor", 422) from None

    def get(
        self, owner_id: int, garment_cursor: str | None = None, page_size: int = 20
    ) -> StatisticsView:
        today = self.clock().astimezone(ZoneInfo("Asia/Shanghai")).date()
        start_date = today - timedelta(days=29)
        cursor = (
            self._decode_cursor(owner_id, garment_cursor)
            if garment_cursor is not None
            else None
        )
        if cursor is not None and cursor.statistics_date != today:
            raise BusinessException(
                40940, "Statistics changed; reload the first page", 409
            )
        before = (cursor.wear_count, cursor.garment_id) if cursor is not None else None
        snapshot = self.repo.snapshot(
            owner_id, start_date, today, before, page_size + 1
        )
        if cursor is not None and (
            cursor.inventory_revision,
            cursor.history_revision,
        ) != (snapshot.inventory_revision, snapshot.history_revision):
            raise BusinessException(
                40940, "Statistics changed; reload the first page", 409
            )
        rows = sorted(
            snapshot.garments,
            key=lambda item: (item.wear_count, item.garment_id),
            reverse=True,
        )
        items = [
            GarmentWearCount(
                garment_id=item.garment_id,
                name=item.name,
                category=item.category,
                status=item.status,
                wear_count=item.wear_count,
            )
            for item in rows[:page_size]
        ]
        next_cursor = None
        if len(rows) > page_size:
            last = items[-1]
            payload = _GarmentCursor(
                owner_id=owner_id,
                statistics_date=today,
                inventory_revision=snapshot.inventory_revision,
                history_revision=snapshot.history_revision,
                wear_count=last.wear_count,
                garment_id=last.garment_id,
            )
            encoded = (
                base64.urlsafe_b64encode(
                    json.dumps(
                        payload.model_dump(mode="json"),
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode()
                )
                .decode()
                .rstrip("=")
            )
            next_cursor = encoded + "." + self._signature(encoded)
        days = dict(snapshot.daily_counts)
        return StatisticsView(
            wardrobe_total=snapshot.wardrobe_total,
            wearable_count=snapshot.wearable_count,
            unavailable_count=snapshot.unavailable_count,
            archived_count=snapshot.archived_count,
            category_counts=[
                CategoryCount(category=category, count=count)
                for category, count in sorted(
                    snapshot.category_counts,
                    key=lambda item: (item[0] is not None, item[0] or ""),
                )
            ],
            wear_record_count=snapshot.wear_record_count,
            trend=WearTrend(
                start_date=start_date,
                end_date=today,
                days=[
                    DailyWearCount(
                        date=start_date + timedelta(days=index),
                        count=days.get(start_date + timedelta(days=index), 0),
                    )
                    for index in range(30)
                ],
            ),
            garment_counts=GarmentCountsPage(items=items, next_cursor=next_cursor),
        )
