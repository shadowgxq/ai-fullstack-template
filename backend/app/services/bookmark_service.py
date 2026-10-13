"""Private bookmark use cases with atomic receipts and account-level locks."""

import hashlib
import json
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from app.core.exceptions import (
    BookmarkGroupImpactChanged,
    BookmarkGroupNameConflict,
    BookmarkKeyConflict,
    BookmarkMoveUnavailable,
    BookmarkOperationPrevented,
    BookmarkResourceUnavailable,
    BusinessException,
)
from app.core.session import transaction
from app.models.bookmark import Bookmark, BookmarkOperation
from app.repositories.bookmark_repository import BookmarkRepository
from app.schemas.bookmark import (
    BookmarkGroupSummary,
    BookmarkGroupWrite,
    BookmarkBatchMove,
    BookmarkListResponse,
    BookmarkResponse,
    BookmarkWrite,
    MutationResult,
    OperationKind,
    OperationResult,
)

PAGE_SIZE = 10
RESOURCE_UNAVAILABLE = 40410
KEY_CONFLICT = 40911
OPERATION_NOT_EXECUTED = 40913
GROUP_NAME_CONFLICT = 40910
GROUP_IMPACT_CHANGED = 40912
MOVE_UNAVAILABLE = 40914


def bookmark_error(code: int) -> BusinessException:
    exceptions = {
        RESOURCE_UNAVAILABLE: BookmarkResourceUnavailable,
        KEY_CONFLICT: BookmarkKeyConflict,
        OPERATION_NOT_EXECUTED: BookmarkOperationPrevented,
        GROUP_NAME_CONFLICT: BookmarkGroupNameConflict,
        GROUP_IMPACT_CHANGED: BookmarkGroupImpactChanged,
        MOVE_UNAVAILABLE: BookmarkMoveUnavailable,
    }
    return exceptions[code]()


def bookmark_response(bookmark: Bookmark) -> BookmarkResponse:
    return BookmarkResponse(
        id=bookmark.id,
        title=bookmark.title,
        url=bookmark.url,
        note=bookmark.note,
        group_id=bookmark.group_id,
        updated_at=bookmark.updated_at,
    )


def operation_result(operation: BookmarkOperation) -> OperationResult:
    return OperationResult(
        operation_id=operation.operation_id,
        kind=operation.kind,
        status=operation.status,
        resource_id=operation.resource_id,
        changed_count=operation.changed_count,
        error_code=operation.error_code,
    )


class BookmarkService:
    def __init__(self, repo: BookmarkRepository) -> None:
        self.repo = repo

    def _lock_user(self, user_id: int, *, shared: bool = False) -> None:
        if not self.repo.lock_user(user_id, shared=shared):
            raise bookmark_error(RESOURCE_UNAVAILABLE)

    def list_bookmarks(
        self, user_id: int, group: str | UUID, keyword: str, page: int
    ) -> BookmarkListResponse:
        with transaction(self.repo.db):
            self._lock_user(user_id, shared=True)
            if isinstance(group, UUID) and self.repo.get_group(user_id, group) is None:
                raise bookmark_error(RESOURCE_UNAVAILABLE)
            rows, total, actual_page, groups, all_count, ungrouped_count = (
                self.repo.list_snapshot(
                    user_id, group, keyword.strip(), page, PAGE_SIZE
                )
            )
            # Materialize before releasing the shared lock/expiring ORM objects.
            result = BookmarkListResponse(
                list=[bookmark_response(row) for row in rows],
                total=total,
                page=actual_page,
                page_size=PAGE_SIZE,
                groups=[
                    BookmarkGroupSummary(id=row.id, name=row.name, count=count)
                    for row, count in groups
                ],
                all_count=all_count,
                ungrouped_count=ungrouped_count,
            )
        return result

    def get_bookmark(self, user_id: int, bookmark_id: UUID) -> BookmarkResponse:
        with transaction(self.repo.db):
            self._lock_user(user_id, shared=True)
            bookmark = self.repo.get_bookmark(user_id, bookmark_id)
            if bookmark is None:
                raise bookmark_error(RESOURCE_UNAVAILABLE)
            result = bookmark_response(bookmark)
        return result

    def mutate(
        self,
        user_id: int,
        operation_id: UUID,
        kind: OperationKind,
        resource_id: UUID | None = None,
        payload: BookmarkWrite | BookmarkGroupWrite | BookmarkBatchMove | None = None,
        expected_count: int | None = None,
    ) -> MutationResult:
        method = {
            "bookmark_create": "POST",
            "bookmark_update": "PUT",
            "bookmark_delete": "DELETE",
            "group_create": "POST",
            "group_rename": "PATCH",
            "group_delete": "DELETE",
            "batch_move": "POST",
        }[kind]
        prefix = (
            "/api/v1/bookmark-groups"
            if kind.startswith("group_")
            else "/api/v1/bookmarks"
        )
        path = prefix + (f"/{resource_id}" if resource_id is not None else "")
        normalized = {
            "method": method,
            "path": path,
            "body": payload.model_dump(mode="json") if payload is not None else None,
        }
        if kind == "batch_move":
            normalized["path"] = "/api/v1/bookmarks/batch-move"
            normalized["body"]["bookmark_ids"] = sorted(
                normalized["body"]["bookmark_ids"]
            )
        if kind == "group_delete":
            # Preserve the M1 hash protocol for existing bookmark receipts.
            normalized["query"] = {"expected_count": expected_count}
        request_hash = hashlib.sha256(
            json.dumps(
                normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=False
            ).encode("utf-8")
        ).hexdigest()
        failure: BusinessException | None = None
        with transaction(self.repo.db):
            self._lock_user(user_id)
            previous = self.repo.get_operation(user_id, operation_id)
            if previous is not None:
                if previous.status == "not_executed":
                    raise bookmark_error(OPERATION_NOT_EXECUTED)
                if previous.request_hash != request_hash:
                    raise bookmark_error(KEY_CONFLICT)
                if previous.status == "failed":
                    failure = bookmark_error(previous.error_code)
                receipt = operation_result(previous)
            else:
                changed_resource_id = None
                changed_count = 0
                try:
                    # Business failures roll back their changes, but the durable
                    # failed receipt must survive in the outer transaction.
                    with self.repo.db.begin_nested():
                        if kind == "batch_move":
                            changed_count = self._change_batch(user_id, payload)
                        elif kind.startswith("group_"):
                            changed_resource_id, changed_count = self._change_group(
                                user_id, kind, resource_id, payload, expected_count
                            )
                        else:
                            changed_resource_id = self._change(
                                user_id, kind, resource_id, payload
                            )
                            changed_count = 1
                except BusinessException as exc:
                    failure = exc
                except IntegrityError as exc:
                    if kind in {
                        "group_create",
                        "group_rename",
                    } and self._is_group_name_conflict(exc):
                        failure = BookmarkGroupNameConflict()
                    else:
                        raise
                receipt = operation_result(
                    self.repo.add_operation(
                        user_id,
                        operation_id,
                        request_hash,
                        kind,
                        "failed" if failure is not None else "succeeded",
                        resource_id=changed_resource_id,
                        changed_count=0 if failure is not None else changed_count,
                        error_code=failure.code if failure is not None else None,
                    )
                )
        if failure is not None:
            raise failure
        return MutationResult(
            operation_id=receipt.operation_id,
            kind=receipt.kind,
            resource_id=receipt.resource_id,
            changed_count=receipt.changed_count,
        )

    def _change(
        self,
        user_id: int,
        kind: OperationKind,
        bookmark_id: UUID | None,
        payload: BookmarkWrite | None,
    ) -> UUID:
        bookmark = None
        if kind != "bookmark_create":
            bookmark = self.repo.get_bookmark(user_id, bookmark_id)
            if bookmark is None:
                raise bookmark_error(RESOURCE_UNAVAILABLE)
        if payload is not None and payload.group_id is not None:
            if self.repo.get_group(user_id, payload.group_id) is None:
                raise bookmark_error(RESOURCE_UNAVAILABLE)
        if kind == "bookmark_create":
            bookmark = self.repo.create_bookmark(
                user_id,
                payload.title,
                payload.url,
                payload.group_id,
                payload.note,
                self.repo.database_time(),
            )
        elif kind == "bookmark_update":
            self.repo.update_bookmark(
                bookmark,
                payload.title,
                payload.url,
                payload.group_id,
                payload.note,
                self.repo.database_time(),
            )
        else:
            self.repo.delete_bookmark(bookmark)
        return bookmark.id

    def _change_batch(self, user_id: int, payload: BookmarkBatchMove) -> int:
        if (
            payload.target_group_id is not None
            and self.repo.get_group(user_id, payload.target_group_id) is None
        ):
            raise BookmarkMoveUnavailable()
        bookmarks = self.repo.get_bookmarks(user_id, payload.bookmark_ids)
        if len(bookmarks) != len(payload.bookmark_ids):
            raise BookmarkMoveUnavailable()
        changed_ids = [
            row.id for row in bookmarks if row.group_id != payload.target_group_id
        ]
        if not changed_ids:
            return 0
        return self.repo.move_bookmarks(
            user_id, changed_ids, payload.target_group_id, self.repo.database_time()
        )

    def _is_group_name_conflict(self, exc: IntegrityError) -> bool:
        if self.repo.is_postgresql:
            return (
                getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
                == "uq_bookmark_groups_name"
            )
        return (
            self.repo.db.get_bind().dialect.name == "sqlite"
            and str(exc.orig)
            == "UNIQUE constraint failed: bookmark_groups.user_id, bookmark_groups.name_key"
        )

    def _change_group(
        self,
        user_id: int,
        kind: OperationKind,
        group_id: UUID | None,
        payload: BookmarkGroupWrite | None,
        expected_count: int | None,
    ) -> tuple[UUID, int]:
        group = None
        if kind != "group_create":
            group = self.repo.get_group(user_id, group_id)
            if group is None:
                raise bookmark_error(RESOURCE_UNAVAILABLE)
        if kind == "group_delete":
            if self.repo.count_group_bookmarks(user_id, group_id) != expected_count:
                raise BookmarkGroupImpactChanged()
            changed_count = self.repo.transfer_group_to_ungrouped(
                user_id, group_id, self.repo.database_time()
            )
            self.repo.delete_group(group)
            return group_id, changed_count
        name_key = "".join(
            char.lower() if "A" <= char <= "Z" else char for char in payload.name
        )
        if kind == "group_create":
            group = self.repo.create_group(user_id, payload.name, name_key)
        else:
            self.repo.rename_group(group, payload.name, name_key)
        return group.id, 1

    def resolve(self, user_id: int, operation_id: UUID) -> OperationResult:
        with transaction(self.repo.db):
            self._lock_user(user_id)
            operation = self.repo.get_operation(user_id, operation_id)
            if operation is None:
                operation = self.repo.add_operation(
                    user_id, operation_id, None, None, "not_executed"
                )
            result = operation_result(operation)
        return result
