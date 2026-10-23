from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_current_user, get_region_service
from app.models.user import User
from app.schemas.response import ApiResponse, success_response
from app.schemas.weather import CityList
from app.services.region_service import RegionService

router = APIRouter(prefix="/cities", tags=["cities"])


@router.get("", response_model=ApiResponse[CityList])
def search_cities(
    q: str = Query(min_length=1, max_length=80),
    cursor: str | None = Query(default=None, min_length=1, max_length=2048),
    current_user: User = Depends(get_current_user),
    service: RegionService = Depends(get_region_service),
):
    return success_response(service.search(q, cursor))
