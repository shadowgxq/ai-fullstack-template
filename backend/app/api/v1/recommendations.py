from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query

from app.api.dependencies import get_current_user, get_recommendation_service
from app.models.user import User
from app.schemas.recommendation import (
    RecommendationCandidates,
    RecommendationCreate,
    RecommendationSelection,
    RecommendationSelectionRequest,
    RecommendationView,
)
from app.schemas.response import ApiResponse, success_response
from app.services.recommendation_service import RecommendationService

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.post("", response_model=ApiResponse[RecommendationView], status_code=202)
def create_recommendation(
    payload: RecommendationCreate,
    idempotency_key: Annotated[
        str, Header(min_length=1, max_length=128, pattern=r"^[!-~]+$")
    ],
    current_user: User = Depends(get_current_user),
    service: RecommendationService = Depends(get_recommendation_service),
):
    return success_response(service.create(current_user.id, payload, idempotency_key))


@router.get("/{request_id}", response_model=ApiResponse[RecommendationView])
def get_recommendation(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    service: RecommendationService = Depends(get_recommendation_service),
):
    return success_response(service.get(current_user.id, request_id))


@router.post("/{request_id}/cancel", response_model=ApiResponse[RecommendationView])
def cancel_recommendation(
    request_id: UUID,
    current_user: User = Depends(get_current_user),
    service: RecommendationService = Depends(get_recommendation_service),
):
    return success_response(service.cancel(current_user.id, request_id))


@router.post(
    "/{request_id}/validate-selection",
    response_model=ApiResponse[RecommendationSelection],
)
def validate_selection(
    request_id: UUID,
    payload: RecommendationSelectionRequest,
    current_user: User = Depends(get_current_user),
    service: RecommendationService = Depends(get_recommendation_service),
):
    return success_response(
        service.validate_selection(current_user.id, request_id, payload.selected_ids)
    )


@router.get(
    "/{request_id}/replacement-candidates",
    response_model=ApiResponse[RecommendationCandidates],
)
def replacement_candidates(
    request_id: UUID,
    exclude_ids: Annotated[list[UUID] | None, Query(max_length=64)] = None,
    cursor: Annotated[str | None, Query(max_length=4096)] = None,
    page_size: Annotated[int, Query(ge=1, le=50)] = 20,
    current_user: User = Depends(get_current_user),
    service: RecommendationService = Depends(get_recommendation_service),
):
    return success_response(
        service.candidates(
            current_user.id, request_id, exclude_ids or [], cursor, page_size
        )
    )
