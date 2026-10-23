from datetime import datetime
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.garment import Garment
from app.models.recommendation import RecommendationOutbox, RecommendationRequest


class RecommendationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(
        self, owner_id: int, request_id: UUID, *, lock: bool = False
    ) -> RecommendationRequest | None:
        query = self.db.query(RecommendationRequest).filter_by(
            owner_id=owner_id, id=request_id
        )
        if lock:
            query = query.with_for_update()
        return query.populate_existing().one_or_none()

    def by_key(self, owner_id: int, key: str) -> RecommendationRequest | None:
        return (
            self.db.query(RecommendationRequest)
            .filter_by(owner_id=owner_id, request_key=key)
            .populate_existing()
            .one_or_none()
        )

    def inventory(self, owner_id: int) -> tuple[int, list[Garment]]:
        count = (
            self.db.query(func.count(Garment.id)).filter_by(owner_id=owner_id).scalar()
        )
        rows, after = [], None
        while True:
            query = self.db.query(Garment).filter_by(
                owner_id=owner_id, status="wearable"
            )
            if after is not None:
                query = query.filter(Garment.id > after)
            batch = query.order_by(Garment.id).limit(256).populate_existing().all()
            rows.extend(batch)
            if len(batch) < 256:
                break
            after = batch[-1].id
        return count, rows

    def create(self, row: RecommendationRequest) -> RecommendationRequest:
        self.db.add(row)
        self.db.flush()
        return row

    def command(
        self, request_id: UUID, kind: str, now: datetime
    ) -> RecommendationOutbox:
        row = (
            self.db.query(RecommendationOutbox)
            .filter_by(request_id=request_id, kind=kind)
            .one_or_none()
        )
        if row is None:
            row = RecommendationOutbox(
                request_id=request_id, kind=kind, available_at=now
            )
            self.db.add(row)
            self.db.flush()
        return row

    def due_ids(self, now: datetime, limit: int) -> list[tuple[int, UUID, UUID]]:
        return (
            self.db.query(
                RecommendationRequest.owner_id,
                RecommendationRequest.id,
                RecommendationOutbox.id,
            )
            .join(
                RecommendationOutbox,
                RecommendationOutbox.request_id == RecommendationRequest.id,
            )
            .filter(
                RecommendationOutbox.state != "done",
                RecommendationOutbox.available_at <= now,
                or_(
                    RecommendationOutbox.lease_until.is_(None),
                    RecommendationOutbox.lease_until <= now,
                ),
            )
            .order_by(RecommendationOutbox.available_at, RecommendationOutbox.id)
            .limit(limit)
            .all()
        )

    def lock_command(self, command_id: UUID) -> RecommendationOutbox:
        return (
            self.db.query(RecommendationOutbox)
            .filter_by(id=command_id)
            .with_for_update()
            .populate_existing()
            .one()
        )

    def flush(self) -> None:
        self.db.flush()
