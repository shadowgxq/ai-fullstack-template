from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from app.api.dependencies import get_current_user, get_wear_service
from app.models.user import User
from app.schemas.response import ApiResponse, success_response
from app.schemas.wear import (
    IsoDate,
    WearCreate,
    WearCreated,
    WearDeleted,
    WearList,
    WearPatch,
    WearView,
)
from app.services.wear_service import WearService

router = APIRouter(prefix="/wear-records", tags=["wear-history"])
IdempotencyKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key", min_length=1, max_length=128, pattern=r"^[\x21-\x7e]+$"
    ),
]


@router.post("", response_model=ApiResponse[WearCreated])
def create_wear_record(
    payload: WearCreate,
    idempotency_key: IdempotencyKey,
    current_user: User = Depends(get_current_user),
    service: WearService = Depends(get_wear_service),
):
    return success_response(service.create(current_user.id, payload, idempotency_key))


@router.get("", response_model=ApiResponse[WearList])
def list_wear_records(
    start_date: IsoDate | None = None,
    end_date: IsoDate | None = None,
    cursor: str | None = Query(None, max_length=4096),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    service: WearService = Depends(get_wear_service),
):
    return success_response(
        service.list(current_user.id, start_date, end_date, cursor, page_size)
    )


@router.get("/{record_id}", response_model=ApiResponse[WearView])
def get_wear_record(
    record_id: UUID,
    current_user: User = Depends(get_current_user),
    service: WearService = Depends(get_wear_service),
):
    return success_response(service.get(current_user.id, record_id))


@router.patch("/{record_id}", response_model=ApiResponse[WearView])
def patch_wear_record(
    record_id: UUID,
    payload: WearPatch,
    current_user: User = Depends(get_current_user),
    service: WearService = Depends(get_wear_service),
):
    return success_response(service.patch(current_user.id, record_id, payload))


@router.delete("/{record_id}", response_model=ApiResponse[WearDeleted])
def delete_wear_record(
    record_id: UUID,
    expected_version: int = Query(..., ge=1),
    current_user: User = Depends(get_current_user),
    service: WearService = Depends(get_wear_service),
):
    return success_response(
        service.delete(current_user.id, record_id, expected_version)
    )
