from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, CheckConstraint, Date, DateTime, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class WeatherContext(Base):
    __tablename__ = "weather_contexts"
    __table_args__ = (
        CheckConstraint("state IN ('available', 'missing')", name="ck_weather_state"),
        CheckConstraint(
            "selection_source IN ('selected', 'saved', 'default', 'location')",
            name="ck_weather_selection",
        ),
        CheckConstraint(
            "(state = 'available' AND missing_reason IS NULL) OR (state = 'missing' AND missing_reason IS NOT NULL)",
            name="ck_weather_missing_reason",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    region_id: Mapped[str] = mapped_column(
        ForeignKey("weather_regions.region_id"), nullable=False
    )
    selection_source: Mapped[str] = mapped_column(String(16), nullable=False)
    weather_date: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    state: Mapped[str] = mapped_column(String(16), nullable=False)
    missing_reason: Mapped[str | None] = mapped_column(String(32))
    payload_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
