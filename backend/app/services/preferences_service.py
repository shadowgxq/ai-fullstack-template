from app.core.exceptions import BusinessException
from app.core.session import transaction
from app.models.wardrobe_preferences import WardrobePreferences
from app.repositories.preferences_repository import PreferencesRepository
from app.repositories.revision_repository import RevisionRepository
from app.schemas.preferences import PreferencesPut, PreferencesView
from app.services.wardrobe_catalog import CATALOG_VERSION, COLORS, OCCASIONS, STYLES


class PreferencesService:
    def __init__(
        self, repo: PreferencesRepository, revisions: RevisionRepository
    ) -> None:
        self.repo = repo
        self.revisions = revisions

    @staticmethod
    def _view(row: WardrobePreferences | None) -> PreferencesView:
        return PreferencesView(
            liked_styles=row.liked_styles if row else [],
            avoided_styles=row.avoided_styles if row else [],
            liked_colors=row.liked_colors if row else [],
            avoided_colors=row.avoided_colors if row else [],
            liked_occasions=row.liked_occasions if row else [],
            avoided_occasions=row.avoided_occasions if row else [],
            comfort_notes=row.comfort_notes if row else None,
            version=row.version if row else 0,
            catalog_version=CATALOG_VERSION,
        )

    def get(self, owner_id: int) -> PreferencesView:
        return self._view(self.repo.get_by_owner_id(owner_id))

    def put(self, owner_id: int, payload: PreferencesPut) -> PreferencesView:
        for field, catalog in (
            ("liked_styles", STYLES),
            ("avoided_styles", STYLES),
            ("liked_colors", COLORS),
            ("avoided_colors", COLORS),
            ("liked_occasions", OCCASIONS),
            ("avoided_occasions", OCCASIONS),
        ):
            if any(option not in catalog for option in getattr(payload, field)):
                raise BusinessException(42260, f"Unknown {field} option", 422)
        fields = payload.model_dump(exclude={"expected_version"})
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            row = self.repo.get_by_owner_id(owner_id, lock=True)
            if payload.expected_version != (row.version if row else 0):
                raise BusinessException(40960, "Preferences version conflict", 409)
            if row is None:
                row = self.repo.create(
                    WardrobePreferences(owner_id=owner_id, version=1, **fields)
                )
            else:
                for field, value in fields.items():
                    setattr(row, field, value)
                row.version += 1
            self.revisions.increment_preferences(revision)
            self.repo.flush()
            response = self._view(row)
        return response
