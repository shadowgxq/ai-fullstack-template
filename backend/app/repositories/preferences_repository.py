from sqlalchemy.orm import Session

from app.models.wardrobe_preferences import WardrobePreferences


class PreferencesRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_owner_id(
        self, owner_id: int, *, lock: bool = False
    ) -> WardrobePreferences | None:
        query = self.db.query(WardrobePreferences).filter(
            WardrobePreferences.owner_id == owner_id
        )
        if lock:
            query = query.with_for_update()
        return query.populate_existing().one_or_none()

    def create(self, preferences: WardrobePreferences) -> WardrobePreferences:
        self.db.add(preferences)
        self.db.flush()
        return preferences

    def flush(self) -> None:
        self.db.flush()
