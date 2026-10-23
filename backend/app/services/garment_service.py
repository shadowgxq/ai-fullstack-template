import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from uuid import UUID

from app.core.exceptions import BusinessException
from app.core.session import transaction
from app.models.garment import Garment
from app.repositories.garment_repository import GarmentRepository
from app.repositories.idempotency_repository import IdempotencyRepository
from app.repositories.media_repository import MediaRepository
from app.repositories.revision_repository import RevisionRepository
from app.schemas.garment import (
    GarmentCreate,
    GarmentCreated,
    GarmentDetail,
    GarmentList,
    GarmentPatch,
    GarmentView,
)
from app.services.wardrobe_catalog import CATEGORIES, COLORS, OCCASIONS, SEASONS


def canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


class GarmentService:
    def __init__(
        self,
        repo: GarmentRepository,
        revisions: RevisionRepository,
        receipts: IdempotencyRepository,
        media: MediaRepository,
        cursor_secret: str,
    ) -> None:
        self.repo = repo
        self.revisions = revisions
        self.receipts = receipts
        self.media = media
        self.cursor_secret = cursor_secret.encode()

    def _validate_fields(self, fields: dict[str, object]) -> None:
        for field, catalog in (
            ("category", CATEGORIES),
            ("color", COLORS),
            ("season", SEASONS),
            ("occasion", OCCASIONS),
        ):
            value = fields.get(field)
            values = (
                value if isinstance(value, list) else ([] if value is None else [value])
            )
            if any(item not in catalog for item in values):
                raise BusinessException(42201, f"Unknown {field} option", 422)

    def _validate_photo(self, owner_id: int, media_id: UUID | None) -> None:
        if media_id is None:
            return
        asset = self.media.lock_owned(owner_id, media_id)
        if asset is None:
            raise BusinessException(40402, "Media not found", 404)
        if asset.purpose != "garment" or asset.status != "ready":
            raise BusinessException(42202, "Photo must be ready garment media", 422)

    def _validate_entity(self, name: str | None, media_id: UUID | None) -> None:
        if not name and media_id is None:
            raise BusinessException(42203, "Name or photo is required", 422)

    def create(self, owner_id: int, payload: GarmentCreate, key: str) -> GarmentCreated:
        fields = payload.model_dump()
        self._validate_fields(fields)
        self._validate_entity(payload.name, payload.photo_media_id)
        payload_hash = hashlib.sha256(
            canonical_json(payload.model_dump(mode="json")).encode()
        ).hexdigest()
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            receipt = self.receipts.get(owner_id, "garment.create", key)
            if receipt is not None:
                if receipt.payload_hash != payload_hash:
                    raise BusinessException(
                        40901, "Idempotency key was used with different content", 409
                    )
                return GarmentCreated.model_validate(receipt.response_json)
            self._validate_photo(owner_id, payload.photo_media_id)
            garment = self.repo.create(Garment(owner_id=owner_id, **fields))
            response = GarmentCreated(id=garment.id, version=garment.version)
            self.receipts.create(
                owner_id,
                "garment.create",
                key,
                payload_hash,
                garment.id,
                response.model_dump(mode="json"),
            )
            self.revisions.increment_inventory(revision)
        return response

    def get(self, owner_id: int, garment_id: UUID) -> GarmentDetail:
        result = self.repo.get_owned_with_wear_count(owner_id, garment_id)
        if result is None:
            raise BusinessException(40403, "Garment not found", 404)
        garment, wear_count = result
        return GarmentDetail(
            **GarmentView.model_validate(garment).model_dump(), wear_count=wear_count
        )

    def patch(
        self, owner_id: int, garment_id: UUID, payload: GarmentPatch
    ) -> GarmentView:
        fields = payload.model_dump(exclude_unset=True, exclude={"expected_version"})
        self._validate_fields(fields)
        with transaction(self.repo.db):
            revision = self.revisions.lock(owner_id)
            garment = self.repo.get_owned(owner_id, garment_id)
            if garment is None:
                raise BusinessException(40403, "Garment not found", 404)
            # Account lock protects the initial read; resource locks then follow
            # UUID order across garment and any newly bound media.
            photo_id = fields.get("photo_media_id")
            resources = [(garment_id, "garment")]
            if photo_id is not None:
                resources.append((photo_id, "media"))
            for resource_id, kind in sorted(resources):
                if kind == "media":
                    self._validate_photo(owner_id, resource_id)
                else:
                    garment = self.repo.get_owned(owner_id, garment_id, lock=True)
                    if garment is None:
                        raise BusinessException(40403, "Garment not found", 404)
            if garment.version != payload.expected_version:
                raise BusinessException(40902, "Garment version conflict", 409)
            self._validate_entity(
                fields.get("name", garment.name),
                fields.get("photo_media_id", garment.photo_media_id),
            )
            for field, value in fields.items():
                setattr(garment, field, value)
            garment.version += 1
            garment.updated_at = datetime.now(timezone.utc)
            self.revisions.increment_inventory(revision)
            self.repo.flush()
            response = GarmentView.model_validate(garment)
        return response

    def list(
        self,
        owner_id: int,
        filters: dict[str, str | None],
        cursor: str | None,
        page_size: int,
    ) -> GarmentList:
        self._validate_fields(filters)
        binding = {"owner": owner_id, "filters": filters}
        before = None
        if cursor is not None:
            try:
                encoded, signature = cursor.split(".")
                expected = hmac.new(
                    self.cursor_secret, encoded.encode(), hashlib.sha256
                ).hexdigest()
                if not hmac.compare_digest(signature, expected):
                    raise ValueError("Invalid signature")
                data = json.loads(
                    base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
                )
                if data["binding"] != binding:
                    raise ValueError("Cursor context changed")
                before = (datetime.fromisoformat(data["created_at"]), UUID(data["id"]))
            except (ValueError, KeyError, TypeError, UnicodeDecodeError):
                raise BusinessException(
                    42204, "Invalid cursor for this query", 422
                ) from None
        rows = self.repo.list_owned(owner_id, filters, before, page_size + 1)
        items = [GarmentView.model_validate(row) for row in rows[:page_size]]
        next_cursor = None
        if len(rows) > page_size:
            last = items[-1]
            encoded = (
                base64.urlsafe_b64encode(
                    canonical_json(
                        {
                            "binding": binding,
                            "created_at": last.created_at.isoformat(),
                            "id": str(last.id),
                        }
                    ).encode()
                )
                .decode()
                .rstrip("=")
            )
            next_cursor = (
                encoded
                + "."
                + hmac.new(
                    self.cursor_secret, encoded.encode(), hashlib.sha256
                ).hexdigest()
            )
        return GarmentList(items=items, next_cursor=next_cursor)
