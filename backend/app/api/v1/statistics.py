from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_user, get_statistics_service
from app.models.user import User
from app.schemas.response import ApiResponse, success_response
from app.schemas.statistics import StatisticsView
from app.services.statistics_service import StatisticsService

router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get("", response_model=ApiResponse[StatisticsView])
def get_statistics(
    garment_cursor: str | None = Query(None, max_length=4096),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    service: StatisticsService = Depends(get_statistics_service),
):
    return success_response(service.get(current_user.id, garment_cursor, page_size))
