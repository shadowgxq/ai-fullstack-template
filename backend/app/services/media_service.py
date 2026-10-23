from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import BinaryIO
from uuid import UUID, uuid4

from app.core.exceptions import BusinessException
from app.core.session import transaction
from app.models.media_asset import MediaAsset
from app.repositories.media_repository import MediaRepository
from app.repositories.revision_repository import RevisionRepository
from app.services.media_store import MediaStore


@dataclass(frozen=True)
class MediaContent:
    file: BinaryIO
    content_type: str


@dataclass(frozen=True)
class CleanupResult:
    scanned: int
    deleted: int
    skipped: int
    failed: int


class MediaService:
    def __init__(
        self, repo: MediaRepository, revisions: RevisionRepository, store: MediaStore
    ) -> None:
        self.repo = repo
        self.revisions = revisions
        self.store = store

    def upload(self, owner_id: int, purpose: str, key: str, raw: bytes) -> MediaAsset:
        if (
            purpose not in {"garment", "avatar"}
            or not key.strip()
            or len(key) > 128
            or any(not 32 <= ord(char) <= 126 for char in key)
        ):
            raise BusinessException(42220, "上传用途或幂等键不符合要求", 422)
        image = self.store.normalize(raw)
        with transaction(self.repo.db):
            self.revisions.lock(owner_id)
            media = self.repo.get_by_key(owner_id, key)
            if media is None:
                media_id = uuid4()
                media = self.repo.create(
                    MediaAsset(
                        id=media_id,
                        owner_id=owner_id,
                        purpose=purpose,
                        idempotency_key=key,
                        original_sha256=image.original_sha256,
                        normalized_sha256=image.normalized_sha256,
                        storage_key=f"{media_id.hex}.{image.suffix}",
                        content_type=image.content_type,
                        size_bytes=len(image.content),
                        width=image.width,
                        height=image.height,
                        status="pending",
                    )
                )
            elif (
                media.purpose != purpose
                or media.original_sha256 != image.original_sha256
            ):
                raise BusinessException(
                    40920, "同次上传的内容已改变，请重新选择图片", 409
                )
            media_id = media.id
        try:
            # 文件锁先于短 DB 事务取得；持有 DB 锁时从不等待文件锁/磁盘 IO。
            with self.store.lock(media_id):
                with transaction(self.repo.db):
                    self.revisions.lock(owner_id)
                    current = self.repo.lock_owned(owner_id, media_id)
                    if current is None or current.status in {"deleting", "deleted"}:
                        raise BusinessException(
                            40921, "该次上传已过期，请重新选择图片", 409
                        )
                    storage_key = current.storage_key
                    digest = current.normalized_sha256
                # 可能已原子发布但 ready 提交或响应失败；同摘要文件直接复用。
                self.store.publish(storage_key, image.content, digest)
                with transaction(self.repo.db):
                    self.revisions.lock(owner_id)
                    current = self.repo.lock_owned(owner_id, media_id)
                    if current is None or current.status in {"deleting", "deleted"}:
                        raise BusinessException(
                            40921, "该次上传已过期，请重新选择图片", 409
                        )
                    current.status = "ready"
                    current.updated_at = datetime.now(timezone.utc)
                    self.repo.db.flush()
                return current
        except OSError:
            raise BusinessException(50320, "图片存储暂时不可用，请重试", 503) from None

    def content(self, owner_id: int, media_id: UUID) -> MediaContent:
        with transaction(self.repo.db):
            media = self.repo.get_owned(owner_id, media_id)
            if media is None or media.status != "ready":
                raise BusinessException(40420, "图片不存在", 404)
            storage_key, content_type = media.storage_key, media.content_type
        try:
            with self.store.lock(media_id):
                # 打开的 fd 可在释放文件锁后流式读取；删除不会改变该 inode 内容。
                file = self.store.open(storage_key)
            return MediaContent(file, content_type)
        except OSError:
            raise BusinessException(50320, "图片暂时无法读取，请重试", 503) from None

    def cleanup(
        self, now: datetime | None = None, batch_size: int = 100
    ) -> CleanupResult:
        if not 1 <= batch_size <= 1000:
            raise ValueError("Cleanup batch size must be between 1 and 1000")
        now = now or datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=24)
        with transaction(self.repo.db):
            candidates = self.repo.cleanup_candidates(cutoff, batch_size)
        deleted = skipped = failed = 0
        for owner_id, media_id in candidates:
            try:
                with self.store.lock(media_id):
                    with transaction(self.repo.db):
                        self.revisions.lock(owner_id)
                        media = self.repo.lock_owned(owner_id, media_id)
                        if (
                            media is None
                            or media.status == "deleted"
                            or self.repo.is_referenced(owner_id, media_id)
                        ):
                            skipped += 1
                            continue
                        created_at = media.created_at
                        if created_at.tzinfo is None:
                            created_at = created_at.replace(tzinfo=timezone.utc)
                        if media.status != "deleting" and created_at >= cutoff:
                            skipped += 1
                            continue
                        media.status = "deleting"
                        media.updated_at = now
                        storage_key = media.storage_key
                        self.repo.db.flush()
                    self.store.remove(storage_key)
                    with transaction(self.repo.db):
                        self.revisions.lock(owner_id)
                        media = self.repo.lock_owned(owner_id, media_id)
                        if media is not None:
                            media.status = "deleted"
                            media.updated_at = now
                            self.repo.db.flush()
                    deleted += 1
            except OSError:
                # deleting 保留，下一次扫描继续；不能删除元数据后丢失恢复线索。
                failed += 1
        return CleanupResult(len(candidates), deleted, skipped, failed)
