from uuid import UUID, uuid4

from pydantic import ValidationError

from app.core.exceptions import BusinessException
from app.core.session import transaction
from app.repositories.profile_repository import ProfileRepository
from app.repositories.weather_repository import WeatherRepository
from app.schemas.weather import WeatherContextRequest, WeatherContextView
from app.services.region_service import RegionService, region_view
from app.services.weather_cache import CachedWeather, WeatherCache
from app.core.weather_catalog import DEFAULT_REGION_ID
from app.services.weather_time import SHANGHAI, day_end, now_shanghai


class WeatherService:
    def __init__(
        self,
        repo: WeatherRepository,
        profiles: ProfileRepository,
        regions: RegionService,
        cache: WeatherCache,
        geocoder,
        *,
        clock=now_shanghai,
    ):
        self.repo, self.profiles, self.regions = repo, profiles, regions
        self.cache, self.geocoder, self.clock = cache, geocoder, clock

    def create(
        self, owner_id: int, request: WeatherContextRequest
    ) -> WeatherContextView:
        # Authentication SELECT can autobegin; explicitly finish it before any HTTP.
        with transaction(self.repo.db):
            if request.location is None:
                if request.city_id is not None:
                    row = self.regions.repo.get(request.city_id)
                    selection = "selected"
                    if row is None:
                        raise BusinessException(42270, "Unknown verified city", 422)
                else:
                    profile = self.profiles.get_by_user_id(owner_id)
                    row = (
                        self.regions.repo.get(profile.city_id)
                        if profile and profile.city_id
                        else None
                    )
                    selection = "saved" if row is not None else "default"
                    if row is None:
                        row = self.regions.repo.get(DEFAULT_REGION_ID)
                    if row is None:
                        raise BusinessException(
                            50372, "Verified city directory unavailable", 503
                        )
                region = region_view(row)
        if request.location is not None:
            place = self.geocoder.reverse(request.location)
            region = self.regions.resolve_hierarchy(
                place.province, place.city, place.district
            )
            selection = "location"
        cached = self.cache.get(region)
        now = self.clock()
        today = now.astimezone(SHANGHAI).date()
        # A midnight-spanning fetch cannot turn yesterday's facts into today's facts.
        if cached.weather_date != today:
            cached = CachedWeather(
                region_id=region.region_id,
                weather_date=today,
                facts=None,
                missing_reason="day_changed",
            )
        view = WeatherContextView(
            context_id=uuid4(),
            region=region,
            selection_source=selection,
            weather_date=today,
            valid_until=day_end(today),
            state="available" if cached.facts else "missing",
            facts=cached.facts,
            missing_reason=cached.missing_reason,
        )
        with transaction(self.repo.db):
            self.repo.create(owner_id, view)
        return view

    def get_owned_context(self, owner_id: int, context_id: UUID) -> WeatherContextView:
        with transaction(self.repo.db):
            return self.get_owned_context_in_transaction(owner_id, context_id)

    def get_owned_context_in_transaction(
        self, owner_id: int, context_id: UUID
    ) -> WeatherContextView:
        row = self.repo.get_owned(owner_id, context_id)
        if row is None:
            raise BusinessException(40470, "Weather context not found", 404)
        try:
            view = WeatherContextView.model_validate(row.payload_snapshot)
            if (
                view.context_id != row.id
                or view.region.region_id != row.region_id
                or view.weather_date != row.weather_date
            ):
                raise ValueError("Weather context snapshot identity mismatch")
            CachedWeather(
                region_id=view.region.region_id,
                weather_date=view.weather_date,
                facts=view.facts,
                missing_reason=view.missing_reason,
            )
        except (ValidationError, ValueError):
            raise BusinessException(
                40973, "Weather context facts are invalid", 409
            ) from None
        now = self.clock()
        if (
            view.weather_date != now.astimezone(SHANGHAI).date()
            or view.valid_until <= now
            or view.valid_until != day_end(view.weather_date)
            or (
                view.facts is not None
                and (view.facts.fetched_at > now or view.state != "available")
            )
            or (view.facts is None and view.state != "missing")
        ):
            raise BusinessException(40973, "Weather context expired", 409)
        return view
