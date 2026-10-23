from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user, get_weather_service
from app.models.user import User
from app.schemas.response import ApiResponse, success_response
from app.schemas.weather import WeatherContextRequest, WeatherContextView
from app.services.weather_service import WeatherService

router = APIRouter(prefix="/weather", tags=["weather"])


@router.post("/context", response_model=ApiResponse[WeatherContextView])
def create_weather_context(
    payload: WeatherContextRequest,
    current_user: User = Depends(get_current_user),
    service: WeatherService = Depends(get_weather_service),
):
    return success_response(service.create(current_user.id, payload))
