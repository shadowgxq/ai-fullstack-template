from datetime import datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.media_asset import MediaAsset


class MediaRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def lock_owned(self, owner_id: int, media_id: UUID) -> MediaAsset | None:
        return (
            self.db.query(MediaAsset)
            .filter(MediaAsset.owner_id == owner_id, MediaAsset.id == media_id)
            .with_for_update()
            .populate_existing()
            .one_or_none()
        )

    def get_owned(self, owner_id: int, media_id: UUID) -> MediaAsset | None:
        return (
            self.db.query(MediaAsset)
            .filter(MediaAsset.owner_id == owner_id, MediaAsset.id == media_id)
            .one_or_none()
        )

    def get_by_key(self, owner_id: int, key: str) -> MediaAsset | None:
        return (
            self.db.query(MediaAsset)
            .filter(MediaAsset.owner_id == owner_id, MediaAsset.idempotency_key == key)
            .one_or_none()
        )

    def create(self, media: MediaAsset) -> MediaAsset:
        self.db.add(media)
        self.db.flush()
        return media

    def is_referenced(self, owner_id: int, media_id: UUID) -> bool:
        from app.models.garment import Garment
        from app.models.user_profile import UserProfile

        garment = self.db.scalar(
            select(Garment.id)
            .where(Garment.owner_id == owner_id, Garment.photo_media_id == media_id)
            .limit(1)
        )
        profile = self.db.scalar(
            select(UserProfile.user_id)
            .where(
                UserProfile.user_id == owner_id, UserProfile.avatar_media_id == media_id
            )
            .limit(1)
        )
        return garment is not None or profile is not None

    def cleanup_candidates(
        self, cutoff: datetime, limit: int
    ) -> list[tuple[int, UUID]]:
        from app.models.garment import Garment
        from app.models.user_profile import UserProfile

        garment_reference = (
            select(Garment.id)
            .where(
                Garment.owner_id == MediaAsset.owner_id,
                Garment.photo_media_id == MediaAsset.id,
            )
            .exists()
        )
        profile_reference = (
            select(UserProfile.user_id)
            .where(
                UserProfile.user_id == MediaAsset.owner_id,
                UserProfile.avatar_media_id == MediaAsset.id,
            )
            .exists()
        )
        # 必须在 LIMIT 前排除引用，避免旧的已绑定行永久占满清理批次。
        statement = (
            select(MediaAsset.owner_id, MediaAsset.id)
            .where(
                or_(
                    MediaAsset.status == "deleting",
                    (MediaAsset.status.in_(["pending", "ready"]))
                    & (MediaAsset.created_at < cutoff),
                ),
                ~garment_reference,
                ~profile_reference,
            )
            .order_by(MediaAsset.created_at, MediaAsset.id)
            .limit(limit)
        )
        return [
            (owner_id, media_id) for owner_id, media_id in self.db.execute(statement)
        ]
