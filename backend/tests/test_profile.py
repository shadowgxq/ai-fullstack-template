from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import event

from app.core.exceptions import BusinessException, ProfileNotFoundException
from app.core.session import transaction
from app.models.media_asset import MediaAsset
from app.models.user import User
from app.models.user_profile import UserProfile
from app.repositories.media_repository import MediaRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.revision_repository import RevisionRepository
from app.repositories.region_repository import RegionRepository
from app.schemas.profile import ProfilePatch
from app.services.profile_service import ProfileService


def profile_service(db):
    return ProfileService(
        ProfileRepository(db),
        RevisionRepository(db),
        MediaRepository(db),
        RegionRepository(db),
    )


@pytest.fixture
def profiles(db_session):
    with transaction(db_session):
        users = [User(username=f"profile-{uuid4().hex}") for _ in range(2)]
        db_session.add_all(users)
        db_session.flush()
        ids = [user.id for user in users]
        for user_id in ids:
            ProfileRepository(db_session).create(user_id)
            RevisionRepository(db_session).create(user_id)
        row = db_session.get(UserProfile, ids[0])
        row.nickname = "原昵称"
        row.city_id = "legacy-unverified-city"
    return db_session, ids[0], ids[1]


def asset(db, owner, purpose="avatar", status="ready"):
    media_id = uuid4()
    with transaction(db):
        db.add(
            MediaAsset(
                id=media_id,
                owner_id=owner,
                purpose=purpose,
                status=status,
                idempotency_key=media_id.hex,
                original_sha256="a" * 64,
                normalized_sha256="b" * 64,
                storage_key=media_id.hex + ".jpg",
                content_type="image/jpeg",
                size_bytes=100,
                width=10,
                height=10,
            )
        )
    return media_id


@pytest.mark.parametrize("version", [None, 0, -1, True, False, 1.0, "1"])
def test_patch_version_rejects_coercion(version):
    with pytest.raises(ValidationError):
        ProfilePatch(expected_version=version)


@pytest.mark.parametrize("field", ["timezone", "phone", "owner_id", "user_id"])
def test_patch_rejects_untrusted_or_unimplemented_fields(field):
    with pytest.raises(ValidationError):
        ProfilePatch.model_validate({"expected_version": 1, field: "unknown"})


def test_patch_requires_version_and_bounds_nickname():
    with pytest.raises(ValidationError):
        ProfilePatch(nickname="name")
    with pytest.raises(ValidationError):
        ProfilePatch(expected_version=1, nickname="名" * 81)
    assert (
        ProfilePatch(expected_version=1, nickname=" " + "名" * 80 + " ").nickname
        == "名" * 80
    )


def test_missing_null_trim_and_expected_only_preserve_city(profiles):
    db, owner, _ = profiles
    service = profile_service(db)
    media_id = asset(db, owner)
    saved = service.patch(
        owner, ProfilePatch(expected_version=1, avatar_media_id=media_id)
    )
    assert (saved.version, saved.nickname, saved.avatar_media_id) == (
        2,
        "原昵称",
        media_id,
    )
    renamed = service.patch(
        owner, ProfilePatch(expected_version=2, nickname="  新昵称  ")
    )
    assert (renamed.nickname, renamed.avatar_media_id) == ("新昵称", media_id)
    unchanged = service.patch(owner, ProfilePatch(expected_version=3))
    assert unchanged.version == 4 and unchanged.nickname == "新昵称"
    cleared = service.patch(
        owner, ProfilePatch(expected_version=4, nickname=None, avatar_media_id=None)
    )
    assert cleared.nickname is cleared.avatar_media_id is None
    blank = service.patch(owner, ProfilePatch(expected_version=5, nickname=" \t\n"))
    assert blank.nickname is None and blank.version == 6
    assert blank.city_id == "legacy-unverified-city"
    revision = RevisionRepository(db).lock(owner)
    assert (revision.inventory_revision, revision.history_revision) == (0, 0)
    assert db.get(MediaAsset, media_id).status == "ready"


@pytest.mark.parametrize(
    ("kind", "expected_status"),
    [
        ("missing", 404),
        ("other", 404),
        ("garment", 422),
        ("pending", 422),
        ("deleting", 422),
        ("deleted", 422),
    ],
)
def test_invalid_avatar_never_changes_profile_or_version(
    profiles, kind, expected_status
):
    db, owner, other = profiles
    media_id = (
        uuid4()
        if kind == "missing"
        else asset(
            db,
            other if kind == "other" else owner,
            purpose="garment" if kind == "garment" else "avatar",
            status=kind if kind in {"pending", "deleting", "deleted"} else "ready",
        )
    )
    with pytest.raises(BusinessException) as error:
        profile_service(db).patch(
            owner,
            ProfilePatch(
                expected_version=1, nickname="不可写", avatar_media_id=media_id
            ),
        )
    assert error.value.status_code == expected_status
    profile = db.get(UserProfile, owner)
    assert (profile.version, profile.nickname, profile.avatar_media_id) == (
        1,
        "原昵称",
        None,
    )


def test_conflict_and_missing_profile_do_not_create_or_overwrite(profiles):
    db, owner, other = profiles
    service = profile_service(db)
    service.patch(owner, ProfilePatch(expected_version=1, nickname="较新昵称"))
    with pytest.raises(BusinessException) as error:
        service.patch(owner, ProfilePatch(expected_version=1, nickname="旧草稿"))
    assert error.value.code == 40950
    assert service.get_profile(owner).nickname == "较新昵称"
    with transaction(db):
        db.delete(db.get(UserProfile, other))
    with pytest.raises(ProfileNotFoundException):
        service.patch(other, ProfilePatch(expected_version=1))
    with pytest.raises(ProfileNotFoundException):
        service.get_profile(other)
    assert db.get(UserProfile, other) is None


def test_commit_failure_rolls_back_version_fields_and_avatar(profiles):
    db, owner, _ = profiles
    media_id = asset(db, owner)

    def fail_commit(session):
        raise RuntimeError("injected profile commit failure")

    event.listen(db, "before_commit", fail_commit)
    try:
        with pytest.raises(RuntimeError, match="profile commit"):
            profile_service(db).patch(
                owner,
                ProfilePatch(
                    expected_version=1, nickname="不可写", avatar_media_id=media_id
                ),
            )
    finally:
        event.remove(db, "before_commit", fail_commit)
    row = db.get(UserProfile, owner)
    assert (row.version, row.nickname, row.avatar_media_id, row.city_id) == (
        1,
        "原昵称",
        None,
        "legacy-unverified-city",
    )
    assert db.get(MediaAsset, media_id).status == "ready"
