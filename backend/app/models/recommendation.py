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
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RecommendationRequest(Base):
    __tablename__ = "recommendation_requests"
    __table_args__ = (
        UniqueConstraint("owner_id", "request_key", name="uq_recommendation_owner_key"),
        CheckConstraint(
            "status IN ('dispatch_pending','generating','ready','failed','cancelled','stale')",
            name="ck_recommendation_status",
        ),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    request_key: Mapped[str] = mapped_column(String(128), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    scene: Mapped[str] = mapped_column(String(16), nullable=False)
    frozen_input: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    outcome: Mapped[str | None] = mapped_column(String(32))
    error_code: Mapped[str | None] = mapped_column(String(64))
    result: Mapped[dict | None] = mapped_column(JSON)
    inventory_count: Mapped[int] = mapped_column(Integer, nullable=False)
    eligible_count: Mapped[int] = mapped_column(Integer, nullable=False)
    ai_run_id: Mapped[UUID | None] = mapped_column(Uuid, unique=True)
    weather_context_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("weather_contexts.id")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    deadline_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class RecommendationOutbox(Base):
    __tablename__ = "recommendation_outbox"
    __table_args__ = (
        UniqueConstraint(
            "request_id", "kind", name="uq_recommendation_outbox_request_kind"
        ),
        CheckConstraint(
            "kind IN ('create','cancel')", name="ck_recommendation_outbox_kind"
        ),
        CheckConstraint(
            "state IN ('pending','leased','done')",
            name="ck_recommendation_outbox_state",
        ),
        Index("ix_recommendation_outbox_due", "state", "available_at"),
    )
    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    request_id: Mapped[UUID] = mapped_column(
        ForeignKey("recommendation_requests.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    state: Mapped[str] = mapped_column(String(16), default="pending", nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lease_token: Mapped[UUID | None] = mapped_column(Uuid)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    last_error: Mapped[str | None] = mapped_column(String(64))
