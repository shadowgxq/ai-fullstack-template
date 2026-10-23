from datetime import date
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.orm import aliased

from app.models.wear_record import WearRecord, WearRecordItem, WearRecordTombstone


class WearRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_owned(
        self, owner_id: int, record_id: UUID, *, lock: bool = False
    ) -> WearRecord | None:
        query = self.db.query(WearRecord).filter_by(owner_id=owner_id, id=record_id)
        if lock:
            query = query.with_for_update().populate_existing()
        return query.one_or_none()

    def _group_rows(self, rows) -> list[tuple[WearRecord, list[WearRecordItem]]]:
        grouped: dict[UUID, tuple[WearRecord, list[WearRecordItem]]] = {}
        for record, item in rows:
            if record.id not in grouped:
                grouped[record.id] = (record, [])
            grouped[record.id][1].append(item)
        return list(grouped.values())

    def read_owned(
        self, owner_id: int, record_id: UUID
    ) -> tuple[WearRecord, list[WearRecordItem]] | None:
        rows = self.db.execute(
            select(WearRecord, WearRecordItem)
            .join(WearRecordItem, WearRecordItem.record_id == WearRecord.id)
            .where(WearRecord.owner_id == owner_id, WearRecord.id == record_id)
            .order_by(WearRecordItem.garment_id)
        ).all()
        grouped = self._group_rows(rows)
        return grouped[0] if grouped else None

    def tombstone(self, owner_id: int, record_id: UUID) -> WearRecordTombstone | None:
        return (
            self.db.query(WearRecordTombstone)
            .filter_by(owner_id=owner_id, record_id=record_id)
            .one_or_none()
        )

    def create(self, record: WearRecord) -> WearRecord:
        self.db.add(record)
        self.db.flush()
        return record

    def items(self, record_ids: list[UUID]) -> list[WearRecordItem]:
        if not record_ids:
            return []
        return (
            self.db.query(WearRecordItem)
            .filter(WearRecordItem.record_id.in_(record_ids))
            .order_by(WearRecordItem.garment_id)
            .all()
        )

    def add_item(self, item: WearRecordItem) -> None:
        self.db.add(item)

    def remove_item(self, item: WearRecordItem) -> None:
        self.db.delete(item)

    def flush(self) -> None:
        self.db.flush()

    def delete(self, record: WearRecord) -> None:
        for item in self.items([record.id]):
            self.db.delete(item)
        self.db.add(
            WearRecordTombstone(
                record_id=record.id,
                owner_id=record.owner_id,
                deleted_version=record.version,
            )
        )
        self.db.flush()
        self.db.delete(record)
        self.db.flush()

    def list_owned(
        self,
        owner_id: int,
        start_date: date | None,
        end_date: date | None,
        before: tuple[date, UUID] | None,
        limit: int,
    ) -> list[tuple[WearRecord, list[WearRecordItem]]]:
        query = self.db.query(WearRecord).filter(WearRecord.owner_id == owner_id)
        if start_date is not None:
            query = query.filter(WearRecord.wear_date >= start_date)
        if end_date is not None:
            query = query.filter(WearRecord.wear_date <= end_date)
        if before is not None:
            wear_date, record_id = before
            query = query.filter(
                or_(
                    WearRecord.wear_date < wear_date,
                    and_(WearRecord.wear_date == wear_date, WearRecord.id < record_id),
                )
            )
        page = (
            query.order_by(WearRecord.wear_date.desc(), WearRecord.id.desc())
            .limit(limit)
            .subquery()
        )
        record = aliased(WearRecord, page)
        rows = self.db.execute(
            select(record, WearRecordItem)
            .join(WearRecordItem, WearRecordItem.record_id == record.id)
            .order_by(
                record.wear_date.desc(), record.id.desc(), WearRecordItem.garment_id
            )
        ).all()
        return self._group_rows(rows)

    def history_summary(
        self, owner_id: int, start_date: date, end_date: date
    ) -> tuple[int, list[tuple[UUID, int, date]]]:
        predicates = (
            WearRecord.owner_id == owner_id,
            WearRecord.wear_date >= start_date,
            WearRecord.wear_date <= end_date,
        )
        record_count = (
            select(func.count())
            .select_from(WearRecord)
            .where(*predicates)
            .correlate(None)
            .scalar_subquery()
        )
        # One SELECT gives the count and all garment aggregates the same read snapshot.
        rows = self.db.execute(
            select(
                WearRecordItem.garment_id,
                func.count(),
                func.max(WearRecord.wear_date),
                record_count,
            )
            .join(WearRecord, WearRecord.id == WearRecordItem.record_id)
            .where(*predicates)
            .group_by(WearRecordItem.garment_id)
            .order_by(WearRecordItem.garment_id)
        ).all()
        return (rows[0][3] if rows else 0, [(row[0], row[1], row[2]) for row in rows])
