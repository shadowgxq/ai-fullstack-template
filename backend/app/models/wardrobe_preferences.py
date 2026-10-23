from sqlalchemy import CheckConstraint, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class WardrobePreferences(Base):
    __tablename__ = "wardrobe_preferences"
    __table_args__ = (
        CheckConstraint("version >= 1", name="ck_preferences_version_positive"),
    )

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    liked_styles: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    avoided_styles: Mapped[list[str]] = mapped_column(
        JSON, default=list, nullable=False
    )
    liked_colors: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    avoided_colors: Mapped[list[str]] = mapped_column(
        JSON, default=list, nullable=False
    )
    liked_occasions: Mapped[list[str]] = mapped_column(
        JSON, default=list, nullable=False
    )
    avoided_occasions: Mapped[list[str]] = mapped_column(
        JSON, default=list, nullable=False
    )
    comfort_notes: Mapped[str | None] = mapped_column(String(500))
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
