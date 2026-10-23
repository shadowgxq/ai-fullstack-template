from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import subprocess
import sys
from threading import Event
from uuid import UUID, uuid4

from PIL import Image
import pytest
from sqlalchemy import event

from app.api.dependencies import get_media_service
from app.core.exceptions import BusinessException
from app.core.security import create_access_token
from app.core.session import transaction
from app.models.garment import Garment
from app.models.media_asset import MediaAsset
from app.models.user import User
from app.models.user_profile import UserProfile
from app.repositories.media_repository import MediaRepository
from app.repositories.revision_repository import RevisionRepository
from app.services.media_service import MediaService
from app.services.media_store import MediaStore
from main import app


def picture(format="JPEG", color="red", exif=None):
    output = BytesIO()
    image = Image.new("RGB", (20, 30), color)
    image.save(output, format=format, **({"exif": exif} if exif else {}))
    return output.getvalue()


@pytest.fixture
def media_context(db_session, tmp_path):
    with transaction(db_session):
        owners = [
            User(username=f"media-{uuid4().hex}", password_hash=None) for _ in range(2)
        ]
        db_session.add_all(owners)
        db_session.flush()
        owner_ids = [owner.id for owner in owners]
        for owner_id in owner_ids:
            RevisionRepository(db_session).create(owner_id)
            db_session.add(UserProfile(user_id=owner_id))
    store = MediaStore(tmp_path / "private")
    return MediaService(
        MediaRepository(db_session), RevisionRepository(db_session), store
    ), owner_ids


@pytest.mark.parametrize("format", ["JPEG", "PNG", "WEBP"])
def test_normalizes_actual_formats_and_strips_exif(tmp_path, format):
    exif = Image.Exif()
    exif[270] = "private metadata"
    store = MediaStore(tmp_path)
    result = store.normalize(picture(format, exif=exif))
    with Image.open(BytesIO(result.content)) as image:
        assert image.size == (20, 30)
        assert not image.getexif()
        assert "exif" not in image.info
    assert result.content_type == "image/jpeg"
    assert result.original_sha256 != result.normalized_sha256


def test_rejects_invalid_size_dimensions_and_paths(tmp_path):
    store = MediaStore(tmp_path, max_bytes=1024)
    for raw in (b"", b"not a photo.jpg", b"x" * 1025):
        with pytest.raises(BusinessException) as error:
            store.normalize(raw)
        assert error.value.status_code == 422
    with pytest.raises(BusinessException):
        MediaStore(tmp_path, max_pixels=599).normalize(picture())
    for key in ("../private.jpg", "/tmp/photo.png", "a.jpg"):
        with pytest.raises(ValueError):
            store.path(key)


def test_publish_rejects_bytes_that_do_not_match_persisted_digest(tmp_path):
    store = MediaStore(tmp_path)
    media_id = uuid4()
    with store.lock(media_id):
        with pytest.raises(OSError, match="digest"):
            store.publish(f"{media_id.hex}.jpg", b"changed encoder output", "0" * 64)
    assert not list(tmp_path.glob("*.jpg"))


def test_file_lock_serializes_distinct_processes(tmp_path):
    media_id = uuid4()
    program = "\n".join(
        [
            "from pathlib import Path",
            "from uuid import UUID",
            "import sys",
            "from app.services.media_store import MediaStore",
            "with MediaStore(Path(sys.argv[1])).lock(UUID(sys.argv[2])):",
            "    temporary = Path(sys.argv[1]) / ('.upload-' + UUID(sys.argv[2]).hex + '-active.tmp')",
            "    temporary.write_bytes(b'in-progress')",
            "    print('locked', flush=True)",
            "    sys.stdin.readline()",
        ]
    )
    process = subprocess.Popen(
        [sys.executable, "-u", "-c", program, str(tmp_path), str(media_id)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    started, acquired = Event(), Event()

    def acquire_other_descriptor():
        started.set()
        with MediaStore(tmp_path).lock(media_id):
            acquired.set()

    try:
        assert process.stdout.readline().strip() == "locked"
        with ThreadPoolExecutor(max_workers=1) as pool:
            future = pool.submit(acquire_other_descriptor)
            try:
                assert started.wait(timeout=5)
                assert not acquired.wait(timeout=0.1)
                assert (tmp_path / f".upload-{media_id.hex}-active.tmp").exists()
            finally:
                process.stdin.write("release\n")
                process.stdin.flush()
            future.result(timeout=5)
        assert acquired.is_set()
        assert not (tmp_path / f".upload-{media_id.hex}-active.tmp").exists()
        assert process.wait(timeout=5) == 0
    finally:
        if process.poll() is None:
            process.communicate(input="release\n", timeout=5)
        for stream in (process.stdin, process.stdout, process.stderr):
            stream.close()


def test_same_upload_reuses_id_and_rejects_changed_payload(media_context):
    service, (owner, _) = media_context
    first = service.upload(owner, "garment", "same", picture())
    media_id = first.id
    assert service.upload(owner, "garment", "same", picture()).id == media_id
    assert service.repo.db.query(MediaAsset).count() == 1
    for purpose, raw in (("avatar", picture()), ("garment", picture(color="blue"))):
        with pytest.raises(BusinessException) as error:
            service.upload(owner, purpose, "same", raw)
        assert error.value.status_code == 409


def test_file_failure_keeps_pending_and_retry_recovers(media_context, monkeypatch):
    service, (owner, _) = media_context
    publish = service.store.publish
    monkeypatch.setattr(
        service.store, "publish", lambda *args: (_ for _ in ()).throw(OSError("disk"))
    )
    with pytest.raises(BusinessException) as error:
        service.upload(owner, "garment", "file-failure", picture())
    assert error.value.status_code == 503
    row = service.repo.get_by_key(owner, "file-failure")
    media_id = row.id
    assert row.status == "pending"
    monkeypatch.setattr(service.store, "publish", publish)
    assert service.upload(owner, "garment", "file-failure", picture()).id == media_id
    assert service.repo.get_by_key(owner, "file-failure").status == "ready"


def test_published_file_survives_ready_commit_failure_and_is_reused(media_context):
    service, (owner, _) = media_context
    db = service.repo.db
    ready_flushed = False

    def detect_ready_flush(session, context):
        nonlocal ready_flushed
        if any(
            isinstance(row, MediaAsset) and row.status == "ready"
            for row in session.dirty
        ):
            ready_flushed = True

    def fail_ready_commit(session):
        if ready_flushed:
            raise RuntimeError("injected ready commit failure")

    event.listen(db, "after_flush", detect_ready_flush)
    event.listen(db, "before_commit", fail_ready_commit)
    try:
        with pytest.raises(RuntimeError, match="ready commit"):
            service.upload(owner, "garment", "db-failure", picture())
    finally:
        event.remove(db, "after_flush", detect_ready_flush)
        event.remove(db, "before_commit", fail_ready_commit)
    row = service.repo.get_by_key(owner, "db-failure")
    media_id, storage_key = row.id, row.storage_key
    assert row.status == "pending"
    assert service.store.path(storage_key).exists()
    before = service.store.path(storage_key).stat().st_ino
    assert service.upload(owner, "garment", "db-failure", picture()).id == media_id
    assert service.store.path(storage_key).stat().st_ino == before


def test_io_never_holds_database_transaction(media_context, monkeypatch):
    service, (owner, _) = media_context
    for name in ("publish", "remove", "open"):
        original = getattr(service.store, name)

        def checked(*args, original=original):
            assert not service.repo.db.in_transaction()
            return original(*args)

        monkeypatch.setattr(service.store, name, checked)
    row = service.upload(owner, "garment", "io-boundary", picture())
    media_id = row.id
    with service.content(owner, media_id).file as file:
        assert file.read()
    with transaction(service.repo.db):
        service.repo.get_owned(owner, media_id).created_at = datetime.now(
            timezone.utc
        ) - timedelta(days=2)
    assert service.cleanup().deleted == 1


def test_cleanup_preserves_garment_and_avatar_references(media_context):
    service, (owner, _) = media_context
    garment_media = service.upload(owner, "garment", "garment", picture())
    garment_id = garment_media.id
    avatar = service.upload(owner, "avatar", "avatar", picture())
    avatar_id = avatar.id
    with transaction(service.repo.db):
        service.repo.db.add(
            Garment(owner_id=owner, name=None, photo_media_id=garment_id)
        )
        service.repo.db.get(UserProfile, owner).avatar_media_id = avatar_id
        for media_id in (garment_id, avatar_id):
            service.repo.get_owned(owner, media_id).created_at = datetime.now(
                timezone.utc
            ) - timedelta(days=2)
    result = service.cleanup()
    assert (result.scanned, result.deleted, result.skipped) == (0, 0, 0)
    for media_id in (garment_id, avatar_id):
        with service.content(owner, media_id).file as file:
            assert file.read()


def test_referenced_oldest_rows_do_not_starve_unreferenced_cleanup(media_context):
    service, (owner, _) = media_context
    referenced_ids = [
        service.upload(owner, "garment", f"bound-{index}", picture()).id
        for index in range(4)
    ]
    avatar_id = service.upload(owner, "avatar", "bound-avatar", picture()).id
    unreferenced_id = service.upload(owner, "garment", "unreferenced", picture()).id
    now = datetime.now(timezone.utc)
    with transaction(service.repo.db):
        for media_id in referenced_ids:
            service.repo.db.add(Garment(owner_id=owner, photo_media_id=media_id))
        service.repo.db.get(UserProfile, owner).avatar_media_id = avatar_id
        for media_id in [*referenced_ids, avatar_id]:
            service.repo.get_owned(owner, media_id).created_at = now - timedelta(days=3)
        service.repo.get_owned(owner, unreferenced_id).created_at = now - timedelta(
            days=2
        )
    result = service.cleanup(now=now, batch_size=2)
    assert (result.scanned, result.deleted, result.skipped) == (1, 1, 0)
    assert service.repo.get_owned(owner, unreferenced_id).status == "deleted"
    for media_id in [*referenced_ids, avatar_id]:
        assert service.repo.get_owned(owner, media_id).status == "ready"


def test_expired_pending_cleanup_removes_only_its_crash_temporary(
    media_context, monkeypatch
):
    service, (owner, _) = media_context
    monkeypatch.setattr(
        service.store,
        "publish",
        lambda *args: (_ for _ in ()).throw(OSError("crash before publication")),
    )
    with pytest.raises(BusinessException):
        service.upload(owner, "garment", "pending-crash", picture())
    row = service.repo.get_by_key(owner, "pending-crash")
    media_id = row.id
    temporary = service.store.root / f".upload-{media_id.hex}-interrupted.tmp"
    temporary.write_bytes(b"partially written image")
    other_temporary = service.store.root / f".upload-{uuid4().hex}-active.tmp"
    other_temporary.write_bytes(b"another media owns this")
    with transaction(service.repo.db):
        row.created_at = datetime.now(timezone.utc) - timedelta(days=2)
    assert service.cleanup().deleted == 1
    assert not temporary.exists()
    assert other_temporary.exists()
    assert service.repo.get_owned(owner, media_id).status == "deleted"


def test_upload_retry_cleans_its_crash_temporary(media_context):
    service, (owner, _) = media_context
    media_id = service.upload(owner, "garment", "retry-crash", picture()).id
    temporary = service.store.root / f".upload-{media_id.hex}-interrupted.tmp"
    temporary.write_bytes(b"unfinished previous attempt")
    assert service.upload(owner, "garment", "retry-crash", picture()).id == media_id
    assert not temporary.exists()


def test_failed_cleanup_retries_deleting_and_tombstone_cannot_revive(
    media_context, monkeypatch
):
    service, (owner, _) = media_context
    row = service.upload(owner, "garment", "expired", picture())
    media_id = row.id
    with transaction(service.repo.db):
        service.repo.get_owned(owner, media_id).created_at = datetime.now(
            timezone.utc
        ) - timedelta(days=2)
    remove = service.store.remove
    monkeypatch.setattr(
        service.store, "remove", lambda *args: (_ for _ in ()).throw(OSError("disk"))
    )
    assert service.cleanup().failed == 1
    assert service.repo.get_owned(owner, media_id).status == "deleting"
    with pytest.raises(BusinessException) as error:
        service.upload(owner, "garment", "expired", picture())
    assert error.value.code == 40921
    monkeypatch.setattr(service.store, "remove", remove)
    assert service.cleanup().deleted == 1
    row = service.repo.get_owned(owner, media_id)
    assert row.status == "deleted"
    assert not service.store.path(row.storage_key).exists()
    with pytest.raises(BusinessException):
        service.upload(owner, "garment", "expired", picture())
    assert not service.store.path(row.storage_key).exists()


def test_actual_multipart_and_authenticated_content(client, media_context):
    service, (owner, other) = media_context
    app.dependency_overrides[get_media_service] = lambda: service
    token = create_access_token(str(owner))
    headers = {"Authorization": f"Bearer {token}", "Idempotency-Key": "api-upload"}
    result = client.post(
        "/api/v1/media",
        headers=headers,
        data={"purpose": "garment"},
        files={"file": ("misleading.txt", picture(), "application/octet-stream")},
    )
    assert result.status_code == 200, result.text
    body = result.json()["data"]
    assert set(body) == {
        "id",
        "purpose",
        "status",
        "content_type",
        "size_bytes",
        "width",
        "height",
    }
    assert body["status"] == "ready"
    media_id = UUID(body["id"])
    content = client.get(f"/api/v1/media/{media_id}/content", headers=headers)
    assert content.status_code == 200
    assert content.headers["cache-control"] == "private, no-store"
    with Image.open(BytesIO(content.content)) as image:
        assert image.size == (20, 30)
    other_headers = {"Authorization": f"Bearer {create_access_token(str(other))}"}
    assert (
        client.get(
            f"/api/v1/media/{media_id}/content", headers=other_headers
        ).status_code
        == 404
    )
    assert client.get(f"/api/v1/media/{media_id}/content").status_code == 401
    assert (
        client.post(
            "/api/v1/media",
            headers=headers,
            data={"purpose": "garment"},
            files={"file": ("bad.jpg", b"bad")},
        ).status_code
        == 422
    )
