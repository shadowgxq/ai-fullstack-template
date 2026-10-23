from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import event, func, select

from app.core.exceptions import BusinessException
from app.core.session import transaction
from app.models.account_revision import AccountRevision
from app.models.user import User
from app.models.wardrobe_preferences import WardrobePreferences
from app.repositories.preferences_repository import PreferencesRepository
from app.repositories.revision_repository import RevisionRepository
from app.schemas.preferences import PreferencesPut
from app.services.preferences_service import PreferencesService
from app.services.wardrobe_catalog import CATALOG_VERSION

SELECTION_FIELDS = (
    "liked_styles",
    "avoided_styles",
    "liked_colors",
    "avoided_colors",
    "liked_occasions",
    "avoided_occasions",
)


def empty_payload(version=0):
    return {
        **dict.fromkeys(SELECTION_FIELDS, []),
        "comfort_notes": None,
        "expected_version": version,
    }


def preferences_service(db, revisions=None):
    return PreferencesService(
        PreferencesRepository(db), revisions or RevisionRepository(db)
    )


@pytest.fixture
def preferences(db_session):
    with transaction(db_session):
        user = User(username=f"preferences-{uuid4().hex}")
        db_session.add(user)
        db_session.flush()
        owner = user.id
        revision = RevisionRepository(db_session).create(owner)
        revision.inventory_revision = 7
        revision.history_revision = 9
    return db_session, owner


@pytest.mark.parametrize("version", [None, -1, True, False, 0.0, "0"])
def test_expected_version_is_strict_nonnegative(version):
    with pytest.raises(ValidationError):
        PreferencesPut.model_validate(empty_payload(version))


@pytest.mark.parametrize(
    "field", [*SELECTION_FIELDS, "comfort_notes", "expected_version"]
)
def test_put_requires_all_fields(field):
    payload = empty_payload()
    del payload[field]
    with pytest.raises(ValidationError) as error:
        PreferencesPut.model_validate(payload)
    assert error.value.errors()[0]["loc"] == (field,)


@pytest.mark.parametrize("field", SELECTION_FIELDS)
@pytest.mark.parametrize("value", [None, ["x"] * 33, ["x" * 41], [""], [1], [True]])
def test_selections_are_bounded_strings(field, value):
    with pytest.raises(ValidationError):
        PreferencesPut.model_validate({**empty_payload(), field: value})


@pytest.mark.parametrize(
    "field", ["owner_id", "scene", "version", "preferences_revision", "catalog_version"]
)
def test_put_rejects_unsupported_fields(field):
    with pytest.raises(ValidationError):
        PreferencesPut.model_validate({**empty_payload(), field: "untrusted"})


@pytest.mark.parametrize(
    "group,value", [("styles", "casual"), ("colors", "white"), ("occasions", "work")]
)
def test_overlap_error_identifies_affected_avoided_field(group, value):
    with pytest.raises(ValidationError) as error:
        PreferencesPut.model_validate(
            {**empty_payload(), f"liked_{group}": [value], f"avoided_{group}": [value]}
        )
    assert error.value.errors()[0]["loc"] == (f"avoided_{group}",)


def test_get_is_empty_without_persisting_or_advancing_revision(preferences):
    db, owner = preferences
    service = preferences_service(db)
    first = service.get(owner)
    assert first.version == 0 and first.comfort_notes is None
    assert first.catalog_version == CATALOG_VERSION
    assert all(getattr(first, field) == [] for field in SELECTION_FIELDS)
    assert service.get(owner) == first
    assert db.scalar(select(func.count()).select_from(WardrobePreferences)) == 0
    assert not db.new and not db.dirty
    assert db.get(AccountRevision, owner).preferences_revision == 0


def test_first_save_canonicalizes_and_clear_stays_saved(preferences):
    db, owner = preferences
    service = preferences_service(db)
    payload = {
        **empty_payload(),
        "liked_styles": ["minimal", "casual", "minimal"],
        "avoided_colors": ["red", "black", "red"],
        "liked_occasions": ["work", "daily"],
        "comfort_notes": "  只保存原文，不解释语义  ",
    }
    saved = service.put(owner, PreferencesPut.model_validate(payload))
    assert saved.version == 1 and saved.liked_styles == ["casual", "minimal"]
    assert saved.avoided_colors == ["black", "red"]
    assert saved.liked_occasions == ["daily", "work"]
    assert saved.comfort_notes == "只保存原文，不解释语义"
    assert service.get(owner) == saved
    cleared = service.put(
        owner,
        PreferencesPut.model_validate({**empty_payload(1), "comfort_notes": " \t\n"}),
    )
    assert cleared.version == 2 and cleared.comfort_notes is None
    assert all(getattr(cleared, field) == [] for field in SELECTION_FIELDS)
    assert db.get(WardrobePreferences, owner) is not None
    revision = db.get(AccountRevision, owner)
    assert (
        revision.inventory_revision,
        revision.history_revision,
        revision.preferences_revision,
    ) == (7, 9, 2)


@pytest.mark.parametrize("field", SELECTION_FIELDS)
def test_unknown_catalog_ids_rejected_without_initial_write(preferences, field):
    db, owner = preferences
    with pytest.raises(BusinessException) as error:
        preferences_service(db).put(
            owner,
            PreferencesPut.model_validate(
                {**empty_payload(), field: ["not-in-catalog"]}
            ),
        )
    assert error.value.code == 42260 and field in error.value.message
    assert db.get(WardrobePreferences, owner) is None
    assert db.get(AccountRevision, owner).preferences_revision == 0


def test_comfort_length_and_nullable_rules():
    assert (
        PreferencesPut.model_validate(
            {**empty_payload(), "comfort_notes": " " + "字" * 500 + " "}
        ).comfort_notes
        == "字" * 500
    )
    with pytest.raises(ValidationError):
        PreferencesPut.model_validate({**empty_payload(), "comfort_notes": "字" * 501})


def test_conflict_does_not_update_saved_content_or_revision(preferences):
    db, owner = preferences
    service = preferences_service(db)
    with pytest.raises(BusinessException) as error:
        service.put(owner, PreferencesPut.model_validate(empty_payload(1)))
    assert error.value.code == 40960 and db.get(WardrobePreferences, owner) is None
    saved = service.put(
        owner,
        PreferencesPut.model_validate({**empty_payload(), "liked_colors": ["white"]}),
    )
    with pytest.raises(BusinessException):
        service.put(owner, PreferencesPut.model_validate(empty_payload(0)))
    assert service.get(owner) == saved
    assert db.get(AccountRevision, owner).preferences_revision == 1


@pytest.mark.parametrize("existing", [False, True])
@pytest.mark.parametrize("stage", ["revision", "commit"])
def test_failure_rolls_back_preferences_version_and_revision(
    preferences, existing, stage
):
    db, owner = preferences
    service = preferences_service(db)
    if existing:
        service.put(
            owner,
            PreferencesPut.model_validate(
                {**empty_payload(), "liked_colors": ["blue"]}
            ),
        )
    original = service.get(owner)

    class FailingRevisionRepository(RevisionRepository):
        def increment_preferences(self, revision):
            super().increment_preferences(revision)
            raise RuntimeError("injected revision failure")

    def fail_commit(session):
        raise RuntimeError("injected commit failure")

    if stage == "revision":
        service = preferences_service(db, FailingRevisionRepository(db))
    else:
        event.listen(db, "before_commit", fail_commit)
    try:
        with pytest.raises(RuntimeError, match="injected"):
            service.put(
                owner, PreferencesPut.model_validate(empty_payload(original.version))
            )
    finally:
        if stage == "commit":
            event.remove(db, "before_commit", fail_commit)
    assert service.get(owner) == original
    revision = db.get(AccountRevision, owner)
    assert (
        revision.inventory_revision,
        revision.history_revision,
        revision.preferences_revision,
    ) == (7, 9, int(existing))
    assert (db.get(WardrobePreferences, owner) is not None) == existing
