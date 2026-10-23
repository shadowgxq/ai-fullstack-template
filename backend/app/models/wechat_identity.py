from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class WechatIdentity(Base):
    __tablename__ = "wechat_identities"
    __table_args__ = (
        UniqueConstraint("app_id", "open_id", name="uq_wechat_identity_app_open"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    app_id: Mapped[str] = mapped_column(String(64), nullable=False)
    open_id: Mapped[str] = mapped_column(String(128), nullable=False)
