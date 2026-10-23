from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.weather_region import WeatherRegion
from app.core.weather_catalog import MAPPING_VERSION


class RegionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(self, region_id: str) -> WeatherRegion | None:
        return self.db.scalar(
            select(WeatherRegion).where(
                WeatherRegion.region_id == region_id,
                WeatherRegion.mapping_version == MAPPING_VERSION,
            )
        )

    def search(self, query: str, after: str | None, limit: int) -> list[WeatherRegion]:
        statement = select(WeatherRegion).where(
            WeatherRegion.mapping_version == MAPPING_VERSION,
            WeatherRegion.search_text.contains(query, autoescape=True),
        )
        if after is not None:
            statement = statement.where(WeatherRegion.region_id > after)
        return list(
            self.db.scalars(statement.order_by(WeatherRegion.region_id).limit(limit))
        )

    def all_current(self) -> list[WeatherRegion]:
        return list(
            self.db.scalars(
                select(WeatherRegion).where(
                    WeatherRegion.mapping_version == MAPPING_VERSION
                )
            )
        )
