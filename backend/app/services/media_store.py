"""私有图片卷；发布/删除共用跨进程锁，文件 IO 不持有业务数据库锁。"""

from contextlib import contextmanager
from dataclasses import dataclass
import fcntl
from hashlib import sha256
from io import BytesIO
import os
from pathlib import Path
import re
import tempfile
from typing import BinaryIO, Iterator
from uuid import UUID
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.exceptions import BusinessException


@dataclass(frozen=True)
class NormalizedImage:
    content: bytes
    content_type: str
    suffix: str
    width: int
    height: int
    original_sha256: str
    normalized_sha256: str


class MediaStore:
    def __init__(
        self,
        root: Path,
        max_bytes: int = 10 * 1024 * 1024,
        max_pixels: int = 25_000_000,
        max_dimension: int = 8192,
    ) -> None:
        self.root = Path(root).resolve()
        self.max_bytes = max_bytes
        self.max_pixels = max_pixels
        self.max_dimension = max_dimension

    def normalize(self, raw: bytes) -> NormalizedImage:
        if not raw or len(raw) > self.max_bytes:
            raise BusinessException(42220, "图片为空或超过大小限制", 422)
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(BytesIO(raw)) as image:
                    if (
                        image.format not in {"JPEG", "PNG", "WEBP"}
                        or getattr(image, "n_frames", 1) != 1
                    ):
                        raise ValueError("Unsupported image")
                    width, height = image.size
                    if (
                        min(width, height) <= 0
                        or max(width, height) > self.max_dimension
                        or width * height > self.max_pixels
                    ):
                        raise ValueError("Image dimensions exceed limit")
                    image.load()
                    oriented = ImageOps.exif_transpose(image)
                    mode = (
                        "RGBA"
                        if "A" in oriented.getbands() or "transparency" in oriented.info
                        else "RGB"
                    )
                    converted = oriented.convert(mode)
                    # 新像素容器丢弃 EXIF、GPS、ICC 和其它原始元数据。
                    clean = Image.frombytes(mode, converted.size, converted.tobytes())
                    output = BytesIO()
                    clean.save(
                        output,
                        format="PNG" if mode == "RGBA" else "JPEG",
                        **({} if mode == "RGBA" else {"quality": 90}),
                    )
                    content = output.getvalue()
                    width, height = clean.size
        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            SyntaxError,
            Image.DecompressionBombError,
            Image.DecompressionBombWarning,
        ):
            raise BusinessException(42220, "图片格式或尺寸不符合要求", 422) from None
        if len(content) > self.max_bytes:
            raise BusinessException(42220, "处理后的图片超过大小限制", 422)
        return NormalizedImage(
            content,
            "image/png" if mode == "RGBA" else "image/jpeg",
            "png" if mode == "RGBA" else "jpg",
            width,
            height,
            sha256(raw).hexdigest(),
            sha256(content).hexdigest(),
        )

    def path(self, storage_key: str) -> Path:
        if not re.fullmatch(r"[0-9a-f]{32}\.(jpg|png)", storage_key):
            raise ValueError("Invalid private media key")
        path = self.root / storage_key
        if path.resolve().parent != self.root:
            raise ValueError("Private media path escaped root")
        return path

    @contextmanager
    def lock(self, media_id: UUID) -> Iterator[None]:
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        directory = self.root / ".locks"
        directory.mkdir(mode=0o700, exist_ok=True)
        # 锁文件不删除，避免另一进程仍锁旧 inode 时创建新锁绕过互斥。
        fd = os.open(directory / f"{media_id.hex}.lock", os.O_CREAT | os.O_RDWR, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX)
            # 崩溃会跳过 publish 的 finally；同媒体锁内只清理本媒体遗留临时文件。
            for temporary in self.root.glob(f".upload-{media_id.hex}-*.tmp"):
                temporary.unlink(missing_ok=True)
            yield
        finally:
            fcntl.flock(fd, fcntl.LOCK_UN)
            os.close(fd)

    def valid_existing(self, storage_key: str, digest: str) -> bool:
        path = self.path(storage_key)
        try:
            with path.open("rb") as file:
                content = file.read(self.max_bytes + 1)
            return (
                len(content) <= self.max_bytes and sha256(content).hexdigest() == digest
            )
        except FileNotFoundError:
            return False

    def publish(self, storage_key: str, content: bytes, digest: str) -> None:
        target = self.path(storage_key)
        if self.valid_existing(storage_key, digest):
            return
        if sha256(content).hexdigest() != digest:
            # 编码器升级后不能用新字节冒充旧上传收据中的规范摘要。
            raise OSError("Normalized media digest no longer matches receipt")
        temporary: str | None = None
        try:
            with tempfile.NamedTemporaryFile(
                dir=self.root,
                prefix=f".upload-{target.stem}-",
                suffix=".tmp",
                delete=False,
            ) as file:
                temporary = file.name
                file.write(content)
                file.flush()
                os.fsync(file.fileno())
            os.replace(temporary, target)
            temporary = None
            self._sync_directory()
        finally:
            if temporary is not None:
                Path(temporary).unlink(missing_ok=True)

    def remove(self, storage_key: str) -> None:
        self.path(storage_key).unlink(missing_ok=True)
        self._sync_directory()

    def open(self, storage_key: str) -> BinaryIO:
        return self.path(storage_key).open("rb")

    def _sync_directory(self) -> None:
        fd = os.open(self.root, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(fd)
        finally:
            os.close(fd)
