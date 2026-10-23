from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.garment import Garment
from app.models.wear_record import WearRecord, WearRecordItem


class GarmentRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_owned(
        self, owner_id: int, garment_id: UUID, *, lock: bool = False
    ) -> Garment | None:
        query = self.db.query(Garment).filter_by(owner_id=owner_id, id=garment_id)
        if lock:
            query = query.with_for_update().populate_existing()
        return query.one_or_none()

    def create(self, garment: Garment) -> Garment:
        self.db.add(garment)
        self.db.flush()
        return garment

    def get_owned_with_wear_count(
        self, owner_id: int, garment_id: UUID
    ) -> tuple[Garment, int] | None:
        wear_count = (
            select(func.count())
            .select_from(WearRecordItem)
            .join(WearRecord, WearRecord.id == WearRecordItem.record_id)
            .where(
                WearRecord.owner_id == owner_id, WearRecordItem.garment_id == Garment.id
            )
            .correlate(Garment)
            .scalar_subquery()
        )
        row = self.db.execute(
            select(Garment, wear_count).where(
                Garment.owner_id == owner_id, Garment.id == garment_id
            )
        ).one_or_none()
        return (row[0], row[1]) if row is not None else None

    def flush(self) -> None:
        self.db.flush()

    def list_owned(
        self,
        owner_id: int,
        filters: dict[str, str | None],
        before: tuple[datetime, UUID] | None,
        limit: int,
    ) -> list[Garment]:
        query = self.db.query(Garment).filter(Garment.owner_id == owner_id)
        for field in ("status", "category", "color"):
            if filters.get(field) is not None:
                query = query.filter(getattr(Garment, field) == filters[field])
        # JSON membership is a database predicate, never an unbounded Python filter.
        for parameter, field in (
            ("season", "season"),
            ("occasion", "occasion"),
            ("tag", "tags"),
        ):
            value = filters.get(parameter)
            if value is not None:
                if self.db.get_bind().dialect.name == "postgresql":
                    elements = (
                        func.json_array_elements_text(getattr(Garment, field))
                        .table_valued("value")
                        .alias()
                    )
                else:
                    elements = (
                        func.json_each(getattr(Garment, field))
                        .table_valued("value")
                        .alias()
                    )
                query = query.filter(
                    select(1)
                    .select_from(elements)
                    .where(elements.c.value == value)
                    .exists()
                )
        if before is not None:
            created_at, garment_id = before
            query = query.filter(
                or_(
                    Garment.created_at < created_at,
                    and_(Garment.created_at == created_at, Garment.id < garment_id),
                )
            )
        return (
            query.order_by(Garment.created_at.desc(), Garment.id.desc())
            .limit(limit)
            .all()
        )
