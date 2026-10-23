from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.weather_context import WeatherContext
from app.schemas.weather import WeatherContextView


class WeatherRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, owner_id: int, view: WeatherContextView) -> None:
        self.db.add(
            WeatherContext(
                id=view.context_id,
                owner_id=owner_id,
                region_id=view.region.region_id,
                selection_source=view.selection_source,
                weather_date=view.weather_date,
                valid_until=view.valid_until,
                state=view.state,
                missing_reason=view.missing_reason,
                payload_snapshot=view.model_dump(mode="json"),
            )
        )
        self.db.flush()

    def get_owned(self, owner_id: int, context_id: UUID) -> WeatherContext | None:
        return self.db.scalar(
            select(WeatherContext).where(
                WeatherContext.id == context_id, WeatherContext.owner_id == owner_id
            )
        )
