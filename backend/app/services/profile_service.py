from app.core.exceptions import BusinessException, ProfileNotFoundException
from app.core.session import transaction
from app.models.user_profile import UserProfile
from app.repositories.media_repository import MediaRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.revision_repository import RevisionRepository
from app.repositories.region_repository import RegionRepository
from app.schemas.profile import ProfilePatch, ProfileResponse


class ProfileService:
    def __init__(
        self,
        repo: ProfileRepository,
        revisions: RevisionRepository,
        media: MediaRepository,
        regions: RegionRepository,
    ) -> None:
        self.repo = repo
        self.revisions = revisions
        self.media = media
        self.regions = regions

    def get_profile(self, user_id: int) -> UserProfile:
        profile = self.repo.get_by_user_id(user_id)
        if profile is None:
            raise ProfileNotFoundException()
        return profile

    def patch(self, user_id: int, payload: ProfilePatch) -> ProfileResponse:
        fields = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
        with transaction(self.repo.db):
            self.revisions.lock(user_id)
            profile = self.repo.lock_by_user_id(user_id)
            if profile is None:
                raise ProfileNotFoundException()
            if profile.version != payload.expected_version:
                raise BusinessException(40950, "Profile version conflict", 409)
            city_id = fields.get("city_id")
            if city_id is not None and self.regions.get(city_id) is None:
                raise BusinessException(42270, "Unknown verified city", 422)
            avatar_id = fields.get("avatar_media_id")
            if avatar_id is not None:
                asset = self.media.lock_owned(user_id, avatar_id)
                if asset is None:
                    raise BusinessException(40402, "Media not found", 404)
                if asset.purpose != "avatar" or asset.status != "ready":
                    raise BusinessException(
                        42250, "Avatar must be ready avatar media", 422
                    )
            for field, value in fields.items():
                setattr(profile, field, value)
            profile.version += 1
            self.repo.flush()
            # 固定本次提交的版本；commit 失败时不会将暂存值返回调用方。
            response = ProfileResponse.model_validate(profile)
        return response
