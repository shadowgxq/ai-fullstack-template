from dataclasses import dataclass
from datetime import date
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Date,
    String,
    Uuid,
    and_,
    cast,
    func,
    literal,
    null,
    or_,
    select,
    union_all,
)
from sqlalchemy.orm import Session

from app.models.account_revision import AccountRevision
from app.models.garment import Garment
from app.models.wear_record import WearRecord, WearRecordItem


@dataclass(frozen=True)
class GarmentUsageRow:
    garment_id: UUID
    name: str | None
    category: str | None
    status: str
    wear_count: int


@dataclass(frozen=True)
class StatisticsSnapshot:
    inventory_revision: int
    history_revision: int
    wardrobe_total: int
    wearable_count: int
    unavailable_count: int
    archived_count: int
    wear_record_count: int
    category_counts: list[tuple[str | None, int]]
    daily_counts: list[tuple[date, int]]
    garments: list[GarmentUsageRow]


class StatisticsRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def snapshot(
        self,
        owner_id: int,
        start_date: date,
        end_date: date,
        before: tuple[int, UUID] | None,
        limit: int,
    ) -> StatisticsSnapshot:
        garments = (
            select(Garment.id, Garment.name, Garment.category, Garment.status)
            .where(Garment.owner_id == owner_id)
            .cte("owned_garments")
        )
        records = (
            select(WearRecord.id, WearRecord.wear_date)
            .where(WearRecord.owner_id == owner_id)
            .cte("owned_records")
        )
        counts = (
            select(WearRecordItem.garment_id, func.count().label("wear_count"))
            .join(records, records.c.id == WearRecordItem.record_id)
            .group_by(WearRecordItem.garment_id)
            .cte("wear_counts")
        )
        usage = (
            select(garments, func.coalesce(counts.c.wear_count, 0).label("wear_count"))
            .outerjoin(counts, counts.c.garment_id == garments.c.id)
            .cte("garment_usage")
        )
        page = select(usage)
        if before is not None:
            wear_count, garment_id = before
            page = page.where(
                or_(
                    usage.c.wear_count < wear_count,
                    and_(usage.c.wear_count == wear_count, usage.c.id < garment_id),
                )
            )
        page = (
            page.order_by(usage.c.wear_count.desc(), usage.c.id.desc())
            .limit(limit)
            .cte("garment_page")
        )

        def row(kind: str, **values):
            # Fixed typed UNION columns keep this a single statement on PostgreSQL
            # and permit the same rule tests on isolated SQLite.
            columns = {
                "garment_id": Uuid(),
                "name": String(),
                "category": String(),
                "status": String(),
                "count": BigInteger(),
                "day": Date(),
                "inventory_revision": BigInteger(),
                "history_revision": BigInteger(),
                "wardrobe_total": BigInteger(),
                "wearable_count": BigInteger(),
                "unavailable_count": BigInteger(),
                "archived_count": BigInteger(),
                "wear_record_count": BigInteger(),
            }
            return select(
                literal(kind).label("kind"),
                *(
                    values.get(key, cast(null(), datatype)).label(key)
                    for key, datatype in columns.items()
                ),
            )

        summary = row(
            "summary",
            inventory_revision=AccountRevision.inventory_revision,
            history_revision=AccountRevision.history_revision,
            wardrobe_total=select(func.count())
            .select_from(garments)
            .where(garments.c.status != "archived")
            .scalar_subquery(),
            archived_count=select(func.count())
            .select_from(garments)
            .where(garments.c.status == "archived")
            .scalar_subquery(),
            wearable_count=select(func.count())
            .select_from(garments)
            .where(garments.c.status == "wearable")
            .scalar_subquery(),
            unavailable_count=select(func.count())
            .select_from(garments)
            .where(garments.c.status == "unavailable")
            .scalar_subquery(),
            wear_record_count=select(func.count())
            .select_from(records)
            .scalar_subquery(),
        ).where(AccountRevision.owner_id == owner_id)
        categories = (
            row("category", category=garments.c.category, count=func.count())
            .select_from(garments)
            .where(garments.c.status != "archived")
            .group_by(garments.c.category)
        )
        daily = (
            row("day", day=records.c.wear_date, count=func.count())
            .select_from(records)
            .where(records.c.wear_date >= start_date, records.c.wear_date <= end_date)
            .group_by(records.c.wear_date)
        )
        garment_page = row(
            "garment",
            garment_id=page.c.id,
            name=page.c.name,
            category=page.c.category,
            status=page.c.status,
            count=page.c.wear_count,
        ).select_from(page)
        rows = (
            self.db.execute(union_all(summary, categories, daily, garment_page))
            .mappings()
            .all()
        )
        summary_row = next(
            (value for value in rows if value["kind"] == "summary"), None
        )
        if summary_row is None:
            raise RuntimeError("Account revision row is missing")
        return StatisticsSnapshot(
            inventory_revision=summary_row["inventory_revision"],
            history_revision=summary_row["history_revision"],
            wardrobe_total=summary_row["wardrobe_total"],
            wearable_count=summary_row["wearable_count"],
            unavailable_count=summary_row["unavailable_count"],
            archived_count=summary_row["archived_count"],
            wear_record_count=summary_row["wear_record_count"],
            category_counts=[
                (value["category"], value["count"])
                for value in rows
                if value["kind"] == "category"
            ],
            daily_counts=[
                (value["day"], value["count"])
                for value in rows
                if value["kind"] == "day"
            ],
            garments=[
                GarmentUsageRow(
                    value["garment_id"],
                    value["name"],
                    value["category"],
                    value["status"],
                    value["count"],
                )
                for value in rows
                if value["kind"] == "garment"
            ],
        )
