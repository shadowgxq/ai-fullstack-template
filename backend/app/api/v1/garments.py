from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from app.api.dependencies import get_current_user, get_garment_service
from app.models.user import User
from app.schemas.garment import (
    GarmentCreate,
    GarmentCreated,
    GarmentDetail,
    GarmentList,
    GarmentPatch,
    GarmentStatus,
    GarmentView,
    WardrobeOptions,
)
from app.schemas.response import ApiResponse, success_response
from app.services.garment_service import GarmentService
from app.services.wardrobe_catalog import wardrobe_options

router = APIRouter(tags=["wardrobe"])
IdempotencyKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key", min_length=1, max_length=128, pattern=r"^[\x21-\x7e]+$"
    ),
]


@router.get("/wardrobe/options", response_model=ApiResponse[WardrobeOptions])
def get_options(current_user: User = Depends(get_current_user)):
    return success_response(wardrobe_options())


@router.post("/garments", response_model=ApiResponse[GarmentCreated])
def create_garment(
    payload: GarmentCreate,
    idempotency_key: IdempotencyKey,
    current_user: User = Depends(get_current_user),
    service: GarmentService = Depends(get_garment_service),
):
    return success_response(service.create(current_user.id, payload, idempotency_key))


@router.get("/garments", response_model=ApiResponse[GarmentList])
def list_garments(
    status: GarmentStatus | None = None,
    category: str | None = Query(None, max_length=40),
    color: str | None = Query(None, max_length=40),
    season: str | None = Query(None, max_length=40),
    occasion: str | None = Query(None, max_length=40),
    tag: str | None = Query(None, min_length=1, max_length=40),
    cursor: str | None = Query(None, max_length=4096),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    service: GarmentService = Depends(get_garment_service),
):
    return success_response(
        service.list(
            current_user.id,
            {
                "status": status,
                "category": category,
                "color": color,
                "season": season,
                "occasion": occasion,
                "tag": tag,
            },
            cursor,
            page_size,
        )
    )


@router.get("/garments/{garment_id}", response_model=ApiResponse[GarmentDetail])
def get_garment(
    garment_id: UUID,
    current_user: User = Depends(get_current_user),
    service: GarmentService = Depends(get_garment_service),
):
    return success_response(service.get(current_user.id, garment_id))


@router.patch("/garments/{garment_id}", response_model=ApiResponse[GarmentView])
def patch_garment(
    garment_id: UUID,
    payload: GarmentPatch,
    current_user: User = Depends(get_current_user),
    service: GarmentService = Depends(get_garment_service),
):
    return success_response(service.patch(current_user.id, garment_id, payload))
