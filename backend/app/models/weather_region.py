from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class WeatherRegion(Base):
    __tablename__ = "weather_regions"

    region_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    weather_code: Mapped[str] = mapped_column(String(9), unique=True, nullable=False)
    province: Mapped[str] = mapped_column(String(80), nullable=False)
    city: Mapped[str] = mapped_column(String(80), nullable=False)
    district: Mapped[str] = mapped_column(String(80), nullable=False)
    display_name: Mapped[str] = mapped_column(String(250), nullable=False)
    aliases: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    search_text: Mapped[str] = mapped_column(Text, nullable=False)
    mapping_version: Mapped[str] = mapped_column(String(64), nullable=False)
