from sqlalchemy import BigInteger, CheckConstraint, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class AccountRevision(Base):
    __tablename__ = "account_revisions"
    __table_args__ = (
        CheckConstraint(
            "inventory_revision >= 0", name="ck_inventory_revision_nonnegative"
        ),
        CheckConstraint(
            "history_revision >= 0", name="ck_history_revision_nonnegative"
        ),
        CheckConstraint(
            "preferences_revision >= 0", name="ck_preferences_revision_nonnegative"
        ),
    )

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    inventory_revision: Mapped[int] = mapped_column(
        BigInteger, default=0, server_default="0", nullable=False
    )
    history_revision: Mapped[int] = mapped_column(
        BigInteger, default=0, server_default="0", nullable=False
    )
    preferences_revision: Mapped[int] = mapped_column(
        BigInteger, default=0, server_default="0", nullable=False
    )
