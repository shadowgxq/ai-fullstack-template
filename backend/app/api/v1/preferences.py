from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user, get_preferences_service
from app.models.user import User
from app.schemas.preferences import PreferencesPut, PreferencesView
from app.schemas.response import ApiResponse, success_response
from app.services.preferences_service import PreferencesService

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get("", response_model=ApiResponse[PreferencesView])
def get_preferences(
    current_user: User = Depends(get_current_user),
    service: PreferencesService = Depends(get_preferences_service),
):
    return success_response(service.get(current_user.id))


@router.put("", response_model=ApiResponse[PreferencesView])
def put_preferences(
    payload: PreferencesPut,
    current_user: User = Depends(get_current_user),
    service: PreferencesService = Depends(get_preferences_service),
):
    return success_response(service.put(current_user.id, payload))
