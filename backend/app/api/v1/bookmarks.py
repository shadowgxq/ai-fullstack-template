"""Authenticated bookmark transport and durable operation recovery."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.session import get_db
from app.models.user import User
from app.repositories.bookmark_repository import BookmarkRepository
from app.schemas.bookmark import (
    BookmarkBatchMove,
    BookmarkListResponse,
    BookmarkGroupWrite,
    BookmarkResponse,
    BookmarkWrite,
    MutationResult,
    OperationResult,
)
from app.schemas.response import ApiResponse, ValidationIssue, success_response
from app.services.bookmark_service import BookmarkService

router = APIRouter(
    tags=["bookmarks"],
    responses={
        401: {"model": ApiResponse[None], "description": "Authentication required"},
        404: {"model": ApiResponse[None], "description": "Resource unavailable"},
        409: {
            "model": ApiResponse[None],
            "description": "Name/impact conflict, operation key conflict or prevented intent",
        },
        422: {
            "model": ApiResponse[list[ValidationIssue]],
            "description": "Safe field validation errors",
        },
        503: {
            "model": ApiResponse[None],
            "description": "Authentication dependency unavailable",
        },
    },
)


def get_bookmark_service(db: Session = Depends(get_db)) -> BookmarkService:
    return BookmarkService(BookmarkRepository(db))


CurrentUser = Annotated[User, Depends(get_current_user)]
Service = Annotated[BookmarkService, Depends(get_bookmark_service)]
OperationKey = Annotated[UUID, Header(alias="Idempotency-Key")]
GroupFilter = Literal["all", "ungrouped"] | UUID


@router.get("/bookmarks", response_model=ApiResponse[BookmarkListResponse])
def list_bookmarks(
    current_user: CurrentUser,
    service: Service,
    group: GroupFilter = "all",
    q: str = "",
    page: int = Query(default=1, ge=1),
):
    return success_response(service.list_bookmarks(current_user.id, group, q, page))


@router.post("/bookmarks", response_model=ApiResponse[MutationResult])
def create_bookmark(
    payload: BookmarkWrite,
    current_user: CurrentUser,
    service: Service,
    operation_id: OperationKey,
):
    return success_response(
        service.mutate(
            current_user.id, operation_id, "bookmark_create", payload=payload
        )
    )


@router.post(
    "/bookmark-operations/{operation_id}/resolve",
    response_model=ApiResponse[OperationResult],
)
def resolve_operation(operation_id: UUID, current_user: CurrentUser, service: Service):
    return success_response(service.resolve(current_user.id, operation_id))


@router.post("/bookmarks/batch-move", response_model=ApiResponse[MutationResult])
def batch_move(
    payload: BookmarkBatchMove,
    current_user: CurrentUser,
    service: Service,
    operation_id: OperationKey,
):
    return success_response(
        service.mutate(current_user.id, operation_id, "batch_move", payload=payload)
    )


@router.get("/bookmarks/{bookmark_id}", response_model=ApiResponse[BookmarkResponse])
def get_bookmark(bookmark_id: UUID, current_user: CurrentUser, service: Service):
    return success_response(service.get_bookmark(current_user.id, bookmark_id))


@router.put("/bookmarks/{bookmark_id}", response_model=ApiResponse[MutationResult])
def update_bookmark(
    bookmark_id: UUID,
    payload: BookmarkWrite,
    current_user: CurrentUser,
    service: Service,
    operation_id: OperationKey,
):
    return success_response(
        service.mutate(
            current_user.id, operation_id, "bookmark_update", bookmark_id, payload
        )
    )


@router.delete("/bookmarks/{bookmark_id}", response_model=ApiResponse[MutationResult])
def delete_bookmark(
    bookmark_id: UUID,
    current_user: CurrentUser,
    service: Service,
    operation_id: OperationKey,
):
    return success_response(
        service.mutate(current_user.id, operation_id, "bookmark_delete", bookmark_id)
    )


@router.post("/bookmark-groups", response_model=ApiResponse[MutationResult])
def create_group(
    payload: BookmarkGroupWrite,
    current_user: CurrentUser,
    service: Service,
    operation_id: OperationKey,
):
    return success_response(
        service.mutate(current_user.id, operation_id, "group_create", payload=payload)
    )


@router.patch("/bookmark-groups/{group_id}", response_model=ApiResponse[MutationResult])
def rename_group(
    group_id: UUID,
    payload: BookmarkGroupWrite,
    current_user: CurrentUser,
    service: Service,
    operation_id: OperationKey,
):
    return success_response(
        service.mutate(current_user.id, operation_id, "group_rename", group_id, payload)
    )


@router.delete(
    "/bookmark-groups/{group_id}", response_model=ApiResponse[MutationResult]
)
def delete_group(
    group_id: UUID,
    current_user: CurrentUser,
    service: Service,
    operation_id: OperationKey,
    expected_count: int = Query(ge=0),
):
    return success_response(
        service.mutate(
            current_user.id,
            operation_id,
            "group_delete",
            group_id,
            expected_count=expected_count,
        )
    )
