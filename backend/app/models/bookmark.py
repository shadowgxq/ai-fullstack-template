"""Private bookmark data and minimal durable operation receipts."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class BookmarkGroup(Base):
    __tablename__ = "bookmark_groups"
    __table_args__ = (
        UniqueConstraint("user_id", "name_key", name="uq_bookmark_groups_name"),
        UniqueConstraint("user_id", "id", name="uq_bookmark_groups_owner_id"),
        Index("ix_bookmark_groups_owner_order", "user_id", "created_at", "id"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(30), nullable=False)
    name_key: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Bookmark(Base):
    __tablename__ = "bookmarks"
    __table_args__ = (
        ForeignKeyConstraint(
            ["user_id", "group_id"],
            ["bookmark_groups.user_id", "bookmark_groups.id"],
            name="fk_bookmarks_owned_group",
            ondelete="RESTRICT",
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


Index(
    "ix_bookmarks_owner_updated",
    Bookmark.user_id,
    Bookmark.updated_at.desc(),
    Bookmark.id.desc(),
)
Index(
    "ix_bookmarks_owner_group_updated",
    Bookmark.user_id,
    Bookmark.group_id,
    Bookmark.updated_at.desc(),
    Bookmark.id.desc(),
)


class BookmarkOperation(Base):
    __tablename__ = "bookmark_operations"
    __table_args__ = (
        CheckConstraint(
            "status IN ('succeeded', 'failed', 'not_executed')",
            name="ck_bookmark_operations_status",
        ),
        CheckConstraint("changed_count >= 0", name="ck_bookmark_operations_count"),
    )

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    operation_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    request_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    resource_id: Mapped[UUID | None] = mapped_column(Uuid, nullable=True)
    changed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
