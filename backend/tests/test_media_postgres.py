from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from io import BytesIO
from threading import Barrier, Event
from uuid import uuid4

from PIL import Image
import pytest
from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.core.exceptions import BusinessException
from app.core.session import transaction
from app.models.media_asset import MediaAsset
from app.models.user import User
from app.models.user_profile import UserProfile
from app.repositories.media_repository import MediaRepository
from app.repositories.revision_repository import RevisionRepository
from app.services.media_service import MediaService
from app.services.media_store import MediaStore
from test_wechat_postgres import postgres_database as postgres_fixture

postgres_database = postgres_fixture


def media_setup(postgres_database):
    engine, migrate = postgres_database
    migrate("head")
    with Session(engine) as db, transaction(db):
        user = User(username=f"media-pg-{uuid4().hex}", password_hash=None)
        db.add(user)
        db.flush()
        owner_id = user.id
        RevisionRepository(db).create(owner_id)
        db.add(UserProfile(user_id=owner_id))
    output = BytesIO()
    Image.new("RGB", (25, 30), "blue").save(output, format="JPEG")
    return engine, owner_id, output.getvalue()


def media_service(db, store):
    return MediaService(MediaRepository(db), RevisionRepository(db), store)


def test_concurrent_same_key_reuses_single_media_and_file(postgres_database, tmp_path):
    engine, owner_id, raw = media_setup(postgres_database)
    barrier = Barrier(2)

    def upload(_):
        with Session(engine) as db:
            service = media_service(db, MediaStore(tmp_path))
            barrier.wait(timeout=10)
            return service.upload(owner_id, "garment", "same-key", raw).id

    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(upload, range(2)))
    assert ids[0] == ids[1]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(MediaAsset)) == 1
        row = db.get(MediaAsset, ids[0])
        assert row.status == "ready"
        assert MediaStore(tmp_path).valid_existing(
            row.storage_key, row.normalized_sha256
        )
    assert len(list(tmp_path.glob("*.jpg"))) == 1


def test_ready_commit_failure_reuses_published_file(postgres_database, tmp_path):
    engine, owner_id, raw = media_setup(postgres_database)
    with Session(engine) as db:
        service = media_service(db, MediaStore(tmp_path))
        ready_flushed = False

        def detect_ready_flush(session, context):
            nonlocal ready_flushed
            if any(
                isinstance(row, MediaAsset) and row.status == "ready"
                for row in session.dirty
            ):
                ready_flushed = True

        def fail_commit(session):
            if ready_flushed:
                raise RuntimeError("injected ready commit failure")

        event.listen(db, "after_flush", detect_ready_flush)
        event.listen(db, "before_commit", fail_commit)
        try:
            with pytest.raises(RuntimeError, match="ready commit"):
                service.upload(owner_id, "garment", "commit-failure", raw)
        finally:
            event.remove(db, "after_flush", detect_ready_flush)
            event.remove(db, "before_commit", fail_commit)
        row = service.repo.get_by_key(owner_id, "commit-failure")
        media_id, path = row.id, service.store.path(row.storage_key)
        assert row.status == "pending" and path.exists()
        inode = path.stat().st_ino
        assert service.upload(owner_id, "garment", "commit-failure", raw).id == media_id
        assert path.stat().st_ino == inode


def test_late_uploader_cannot_publish_after_cleanup(postgres_database, tmp_path):
    engine, owner_id, raw = media_setup(postgres_database)
    before_lock, resume = Event(), Event()

    class DelayedStore(MediaStore):
        @contextmanager
        def lock(self, media_id):
            before_lock.set()
            assert resume.wait(timeout=10)
            with super().lock(media_id):
                yield

    def upload():
        with Session(engine) as db:
            return media_service(db, DelayedStore(tmp_path)).upload(
                owner_id, "garment", "delayed", raw
            )

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(upload)
        try:
            assert before_lock.wait(timeout=10)
            with Session(engine) as db:
                service = media_service(db, MediaStore(tmp_path))
                with transaction(db):
                    row = service.repo.get_by_key(owner_id, "delayed")
                    media_id = row.id
                    row.created_at = datetime.now(timezone.utc) - timedelta(days=2)
                assert service.cleanup().deleted == 1
            resume.set()
            with pytest.raises(BusinessException) as error:
                future.result(timeout=10)
            assert error.value.code == 40921
        finally:
            resume.set()
    with Session(engine) as db:
        row = db.get(MediaAsset, media_id)
        assert row.status == "deleted"
        assert not MediaStore(tmp_path).path(row.storage_key).exists()
