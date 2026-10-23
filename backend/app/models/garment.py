from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class Garment(Base):
    __tablename__ = "garments"
    __table_args__ = (
        CheckConstraint(
            "length(trim(coalesce(name, ''))) > 0 OR photo_media_id IS NOT NULL",
            name="ck_garment_name_or_photo",
        ),
        CheckConstraint(
            "status IN ('wearable', 'unavailable', 'archived')",
            name="ck_garment_status",
        ),
        CheckConstraint("version >= 1", name="ck_garment_version_positive"),
        Index("ix_garments_owner_created_id", "owner_id", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    name: Mapped[str | None] = mapped_column(String(120))
    photo_media_id: Mapped[UUID | None] = mapped_column(ForeignKey("media_assets.id"))
    category: Mapped[str | None] = mapped_column(String(40))
    color: Mapped[str | None] = mapped_column(String(40))
    season: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    occasion: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="wearable", nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
