from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class WearRecord(Base):
    __tablename__ = "wear_records"
    __table_args__ = (
        CheckConstraint("version >= 1", name="ck_wear_version_positive"),
        Index("ix_wear_owner_date_id", "owner_id", "wear_date", "id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    wear_date: Mapped[date] = mapped_column(Date, nullable=False)
    recommendation_request_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("recommendation_requests.id", name="fk_wear_recommendation_request")
    )
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


class WearRecordItem(Base):
    __tablename__ = "wear_record_items"
    __table_args__ = (Index("ix_wear_items_garment_record", "garment_id", "record_id"),)

    record_id: Mapped[UUID] = mapped_column(
        ForeignKey("wear_records.id", ondelete="CASCADE"), primary_key=True
    )
    garment_id: Mapped[UUID] = mapped_column(
        ForeignKey("garments.id"), primary_key=True
    )
    name_snapshot: Mapped[str | None] = mapped_column(String(120))
    category_snapshot: Mapped[str | None] = mapped_column(String(40))


class WearRecordTombstone(Base):
    __tablename__ = "wear_record_tombstones"
    __table_args__ = (
        CheckConstraint(
            "deleted_version >= 1", name="ck_wear_deleted_version_positive"
        ),
    )

    record_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    deleted_version: Mapped[int] = mapped_column(Integer, nullable=False)
    deleted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
