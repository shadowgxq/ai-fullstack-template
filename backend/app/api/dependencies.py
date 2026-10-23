"""HTTP authentication and request-scoped dependency composition."""

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.exceptions import TokenRevokedException
from app.core.config import settings
from app.core.security import decode_access_token
from app.core.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.profile_repository import ProfileRepository
from app.repositories.wechat_identity_repository import WechatIdentityRepository
from app.services import auth_redis_service
from app.repositories.revision_repository import RevisionRepository
from app.repositories.idempotency_repository import IdempotencyRepository
from app.repositories.garment_repository import GarmentRepository
from app.repositories.media_repository import MediaRepository
from app.repositories.wear_repository import WearRepository
from app.repositories.statistics_repository import StatisticsRepository
from app.repositories.preferences_repository import PreferencesRepository
from app.services.preferences_service import PreferencesService
from app.services.statistics_service import StatisticsService
from app.services.wear_service import WearService
from app.services.garment_service import GarmentService
from app.services.media_service import MediaService
from app.services.media_store import MediaStore
from app.services.cache_service import get_user_cache, set_user_cache
from app.services.auth_service import AuthService
from app.services.profile_service import ProfileService
from app.core import redis_client as redis_module
from app.repositories.region_repository import RegionRepository
from app.repositories.weather_repository import WeatherRepository
from app.services.region_service import RegionService
from app.services.weather_cache import WeatherCache
from app.services.weather_service import WeatherService
from app.repositories.recommendation_repository import RecommendationRepository
from app.services.recommendation_service import RecommendationService
from app.services.ai_runtime_client import AiRuntimeClient
from app.services.weather_source import OfficialWeatherSource, TencentGeocoder
from app.services.wechat_service import (
    HttpWechatCodeExchange,
    WechatAuthService,
    WechatCodeExchange,
)

bearer = HTTPBearer(auto_error=False)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(
        UserRepository(db), ProfileRepository(db), RevisionRepository(db)
    )


def get_garment_service(db: Session = Depends(get_db)) -> GarmentService:
    return GarmentService(
        GarmentRepository(db),
        RevisionRepository(db),
        IdempotencyRepository(db),
        MediaRepository(db),
        settings.secret_key,
    )


def get_media_service(db: Session = Depends(get_db)) -> MediaService:
    return MediaService(
        MediaRepository(db),
        RevisionRepository(db),
        MediaStore(
            settings.media_root,
            settings.media_max_bytes,
            settings.media_max_pixels,
            settings.media_max_dimension,
        ),
    )


def get_wear_service(db: Session = Depends(get_db)) -> WearService:
    return WearService(
        WearRepository(db),
        GarmentRepository(db),
        RevisionRepository(db),
        IdempotencyRepository(db),
        settings.secret_key,
        recommendations=get_recommendation_service(db),
    )


def get_statistics_service(db: Session = Depends(get_db)) -> StatisticsService:
    return StatisticsService(StatisticsRepository(db), settings.secret_key)


def get_preferences_service(db: Session = Depends(get_db)) -> PreferencesService:
    return PreferencesService(PreferencesRepository(db), RevisionRepository(db))


def get_wechat_code_exchange() -> WechatCodeExchange:
    secret = settings.wechat_app_secret
    return HttpWechatCodeExchange(
        settings.wechat_app_id,
        secret.get_secret_value() if secret is not None else None,
        settings.wechat_timeout_seconds,
    )


def get_wechat_auth_service(
    db: Session = Depends(get_db),
    exchange: WechatCodeExchange = Depends(get_wechat_code_exchange),
) -> WechatAuthService:
    return WechatAuthService(
        UserRepository(db),
        WechatIdentityRepository(db),
        ProfileRepository(db),
        exchange,
        RevisionRepository(db),
    )


def get_profile_service(db: Session = Depends(get_db)) -> ProfileService:
    return ProfileService(
        ProfileRepository(db),
        RevisionRepository(db),
        MediaRepository(db),
        RegionRepository(db),
    )


def get_region_service(db: Session = Depends(get_db)) -> RegionService:
    return RegionService(RegionRepository(db), settings.secret_key)


def get_weather_source() -> OfficialWeatherSource:
    return OfficialWeatherSource(
        settings.weather_timeout_seconds, settings.weather_max_bytes
    )


def get_geocoder() -> TencentGeocoder:
    key = settings.tencent_map_key
    return TencentGeocoder(
        key.get_secret_value() if key else None,
        settings.weather_timeout_seconds,
        settings.weather_max_bytes,
    )


def get_weather_service(
    db: Session = Depends(get_db),
    source: OfficialWeatherSource = Depends(get_weather_source),
    geocoder: TencentGeocoder = Depends(get_geocoder),
) -> WeatherService:
    return WeatherService(
        WeatherRepository(db),
        ProfileRepository(db),
        get_region_service(db),
        WeatherCache(redis_module.redis_client, source),
        geocoder,
    )


def get_recommendation_service(db: Session = Depends(get_db)) -> RecommendationService:
    key = settings.ai_service_api_key
    weather = WeatherService(
        WeatherRepository(db),
        ProfileRepository(db),
        get_region_service(db),
        WeatherCache(redis_module.redis_client, get_weather_source()),
        get_geocoder(),
    )
    return RecommendationService(
        RecommendationRepository(db),
        RevisionRepository(db),
        PreferencesRepository(db),
        WearRepository(db),
        weather,
        AiRuntimeClient(
            settings.ai_service_base_url,
            key.get_secret_value() if key else None,
            settings.ai_service_timeout_seconds,
            settings.ai_service_max_response_bytes,
        ),
        settings.secret_key,
    )


def unauthorized() -> HTTPException:
    return HTTPException(
        401, "Could not validate credentials", headers={"WWW-Authenticate": "Bearer"}
    )


def get_access_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> str:
    if credentials is None:
        raise unauthorized()
    return credentials.credentials


def get_current_user(
    token: str = Depends(get_access_token), db: Session = Depends(get_db)
) -> User:
    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
        # User.id is a PostgreSQL INTEGER, not an arbitrary JWT subject.
        if not 0 < user_id <= 2_147_483_647:
            raise ValueError("Invalid user subject")
    except (JWTError, ValueError, TypeError, KeyError):
        raise unauthorized() from None

    if auth_redis_service.is_token_blacklisted(payload["jti"]):
        raise TokenRevokedException()
    cached_user = get_user_cache(user_id)
    if cached_user:
        return User(
            id=cached_user["id"], username=cached_user["username"], password_hash=""
        )
    user = UserRepository(db).get_by_id(user_id)
    if user is None:
        raise unauthorized()
    set_user_cache(
        user_id=user.id, user_data={"id": user.id, "username": user.username}
    )
    return user
