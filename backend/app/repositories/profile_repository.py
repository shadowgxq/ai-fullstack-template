from sqlalchemy.orm import Session

from app.models.user_profile import UserProfile


class ProfileRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, user_id: int) -> UserProfile:
        profile = UserProfile(user_id=user_id, version=1)
        self.db.add(profile)
        self.db.flush()
        return profile

    def get_by_user_id(self, user_id: int) -> UserProfile | None:
        return self.db.get(UserProfile, user_id)

    def lock_by_user_id(self, user_id: int) -> UserProfile | None:
        return (
            self.db.query(UserProfile)
            .filter(UserProfile.user_id == user_id)
            .with_for_update()
            .populate_existing()
            .one_or_none()
        )

    def flush(self) -> None:
        self.db.flush()
