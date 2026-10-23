from uuid import UUID

from sqlalchemy import ForeignKey, Integer, JSON, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class IdempotencyReceipt(Base):
    __tablename__ = "idempotency_receipts"
    __table_args__ = (
        UniqueConstraint(
            "owner_id", "operation", "key", name="uq_idempotency_owner_operation_key"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    operation: Mapped[str] = mapped_column(String(64), nullable=False)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    payload_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)
    response_json: Mapped[dict[str, str | int]] = mapped_column(JSON, nullable=False)
