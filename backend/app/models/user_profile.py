from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class UserProfile(Base):
    __tablename__ = "user_profiles"
    __table_args__ = (
        CheckConstraint("version >= 1", name="ck_profile_version_positive"),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    nickname: Mapped[str | None] = mapped_column(String(80))
    avatar_media_id: Mapped[UUID | None] = mapped_column(Uuid)
    city_id: Mapped[str | None] = mapped_column(String(64))
    version: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1", nullable=False
    )
