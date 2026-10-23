from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user, get_profile_service
from app.models.user import User
from app.schemas.profile import ProfilePatch, ProfileResponse
from app.schemas.response import ApiResponse, success_response
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ApiResponse[ProfileResponse])
def get_profile(
    current_user: User = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    profile = service.get_profile(current_user.id)
    return success_response(ProfileResponse.model_validate(profile))


@router.patch("", response_model=ApiResponse[ProfileResponse])
def patch_profile(
    payload: ProfilePatch,
    current_user: User = Depends(get_current_user),
    service: ProfileService = Depends(get_profile_service),
):
    return success_response(service.patch(current_user.id, payload))
