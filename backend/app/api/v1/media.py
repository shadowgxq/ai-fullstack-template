from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, UploadFile
from fastapi.responses import StreamingResponse

from app.api.dependencies import get_current_user, get_media_service
from app.models.user import User
from app.schemas.media import MediaPurpose, MediaResponse
from app.schemas.response import ApiResponse, success_response
from app.services.media_service import MediaService

router = APIRouter(prefix="/media", tags=["media"])


@router.post("", response_model=ApiResponse[MediaResponse])
def upload_media(
    file: Annotated[UploadFile, File()],
    purpose: Annotated[MediaPurpose, Form()],
    idempotency_key: Annotated[str, Header(min_length=1, max_length=128)],
    current_user: User = Depends(get_current_user),
    service: MediaService = Depends(get_media_service),
):
    try:
        raw = file.file.read(service.store.max_bytes + 1)
    finally:
        file.file.close()
    media = service.upload(current_user.id, purpose, idempotency_key, raw)
    return success_response(MediaResponse.model_validate(media))


@router.get(
    "/{media_id}/content",
    response_class=StreamingResponse,
    responses={200: {"content": {"image/jpeg": {}, "image/png": {}}}},
)
def download_media(
    media_id: UUID,
    current_user: User = Depends(get_current_user),
    service: MediaService = Depends(get_media_service),
):
    content = service.content(current_user.id, media_id)

    def chunks():
        with content.file:
            while chunk := content.file.read(64 * 1024):
                yield chunk

    return StreamingResponse(
        chunks(),
        media_type=content.content_type,
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
