"""Owner-scoped persistence; the service owns all transaction boundaries."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.models.bookmark import Bookmark, BookmarkGroup, BookmarkOperation
from app.models.user import User

ASCII_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
ASCII_LOWER = "abcdefghijklmnopqrstuvwxyz"


class BookmarkRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def lock_user(self, user_id: int, *, shared: bool = False) -> bool:
        # Lock the persisted row even when authentication returned a cached User.
        return (
            self.db.scalar(
                select(User.id).where(User.id == user_id).with_for_update(read=shared)
            )
            is not None
        )

    def database_time(self) -> datetime:
        value = self.db.scalar(
            select(
                func.clock_timestamp()
                if self.is_postgresql
                else func.current_timestamp()
            )
        )
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value

    @property
    def is_postgresql(self) -> bool:
        return self.db.get_bind().dialect.name == "postgresql"

    def get_group(self, user_id: int, group_id: UUID) -> BookmarkGroup | None:
        return self.db.scalar(
            select(BookmarkGroup).where(
                BookmarkGroup.user_id == user_id, BookmarkGroup.id == group_id
            )
        )

    def get_bookmark(self, user_id: int, bookmark_id: UUID) -> Bookmark | None:
        return self.db.scalar(
            select(Bookmark).where(
                Bookmark.user_id == user_id, Bookmark.id == bookmark_id
            )
        )

    def get_bookmarks(self, user_id: int, bookmark_ids: list[UUID]) -> list[Bookmark]:
        return list(
            self.db.scalars(
                select(Bookmark).where(
                    Bookmark.user_id == user_id, Bookmark.id.in_(bookmark_ids)
                )
            )
        )

    def move_bookmarks(
        self,
        user_id: int,
        bookmark_ids: list[UUID],
        target_group_id: UUID | None,
        timestamp: datetime,
    ) -> int:
        result = self.db.execute(
            update(Bookmark)
            .where(
                Bookmark.user_id == user_id,
                Bookmark.id.in_(bookmark_ids),
                Bookmark.group_id.is_distinct_from(target_group_id),
            )
            .values(group_id=target_group_id, updated_at=timestamp)
            .execution_options(synchronize_session=False)
        )
        return result.rowcount

    def create_group(self, user_id: int, name: str, name_key: str) -> BookmarkGroup:
        group = BookmarkGroup(user_id=user_id, name=name, name_key=name_key)
        self.db.add(group)
        self.db.flush()
        return group

    def rename_group(self, group: BookmarkGroup, name: str, name_key: str) -> None:
        group.name = name
        group.name_key = name_key
        self.db.flush()

    def count_group_bookmarks(self, user_id: int, group_id: UUID) -> int:
        return (
            self.db.scalar(
                select(func.count(Bookmark.id)).where(
                    Bookmark.user_id == user_id, Bookmark.group_id == group_id
                )
            )
            or 0
        )

    def transfer_group_to_ungrouped(
        self, user_id: int, group_id: UUID, timestamp: datetime
    ) -> int:
        result = self.db.execute(
            update(Bookmark)
            .where(Bookmark.user_id == user_id, Bookmark.group_id == group_id)
            .values(group_id=None, updated_at=timestamp)
            .execution_options(synchronize_session=False)
        )
        return result.rowcount

    def delete_group(self, group: BookmarkGroup) -> None:
        self.db.delete(group)
        self.db.flush()

    def list_snapshot(
        self, user_id: int, group: str | UUID, keyword: str, page: int, page_size: int
    ) -> tuple[list[Bookmark], int, int, list[tuple[BookmarkGroup, int]], int, int]:
        counts = dict(
            self.db.execute(
                select(Bookmark.group_id, func.count(Bookmark.id))
                .where(Bookmark.user_id == user_id)
                .group_by(Bookmark.group_id)
            ).all()
        )
        groups = list(
            self.db.scalars(
                select(BookmarkGroup)
                .where(BookmarkGroup.user_id == user_id)
                .order_by(BookmarkGroup.created_at.asc(), BookmarkGroup.id.asc())
            )
        )
        query = select(Bookmark).where(Bookmark.user_id == user_id)
        if group == "ungrouped":
            query = query.where(Bookmark.group_id.is_(None))
        elif isinstance(group, UUID):
            query = query.where(Bookmark.group_id == group)
        if keyword:
            escaped = keyword.translate(str.maketrans(ASCII_UPPER, ASCII_LOWER))
            escaped = (
                escaped.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            )
            pattern = f"%{escaped}%"
            # PostgreSQL lower() is locale-sensitive; the contract only folds ASCII.
            title = (
                func.translate(Bookmark.title, ASCII_UPPER, ASCII_LOWER)
                if self.is_postgresql
                else func.lower(Bookmark.title)
            )
            url = (
                func.translate(Bookmark.url, ASCII_UPPER, ASCII_LOWER)
                if self.is_postgresql
                else func.lower(Bookmark.url)
            )
            query = query.where(
                or_(title.like(pattern, escape="\\"), url.like(pattern, escape="\\"))
            )
        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        actual_page = min(page, max(1, (total + page_size - 1) // page_size))
        bookmarks = list(
            self.db.scalars(
                query.order_by(Bookmark.updated_at.desc(), Bookmark.id.desc())
                .offset((actual_page - 1) * page_size)
                .limit(page_size)
            )
        )
        return (
            bookmarks,
            total,
            actual_page,
            [(group, counts.get(group.id, 0)) for group in groups],
            sum(counts.values()),
            counts.get(None, 0),
        )

    def create_bookmark(
        self,
        user_id: int,
        title: str,
        url: str,
        group_id: UUID | None,
        note: str,
        timestamp: datetime,
    ) -> Bookmark:
        bookmark = Bookmark(
            user_id=user_id,
            title=title,
            url=url,
            group_id=group_id,
            note=note,
            created_at=timestamp,
            updated_at=timestamp,
        )
        self.db.add(bookmark)
        self.db.flush()
        return bookmark

    def update_bookmark(
        self,
        bookmark: Bookmark,
        title: str,
        url: str,
        group_id: UUID | None,
        note: str,
        timestamp: datetime,
    ) -> None:
        bookmark.title = title
        bookmark.url = url
        bookmark.group_id = group_id
        bookmark.note = note
        bookmark.updated_at = timestamp
        self.db.flush()

    def delete_bookmark(self, bookmark: Bookmark) -> None:
        self.db.delete(bookmark)
        self.db.flush()

    def get_operation(
        self, user_id: int, operation_id: UUID
    ) -> BookmarkOperation | None:
        return self.db.get(BookmarkOperation, (user_id, operation_id))

    def add_operation(
        self,
        user_id: int,
        operation_id: UUID,
        request_hash: str | None,
        kind: str | None,
        status: str,
        resource_id: UUID | None = None,
        changed_count: int = 0,
        error_code: int | None = None,
    ) -> BookmarkOperation:
        operation = BookmarkOperation(
            user_id=user_id,
            operation_id=operation_id,
            request_hash=request_hash,
            kind=kind,
            status=status,
            resource_id=resource_id,
            changed_count=changed_count,
            error_code=error_code,
        )
        self.db.add(operation)
        self.db.flush()
        return operation
