from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr, field_validator


class Settings(BaseSettings):
    database_url: str

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    redis_url: str = "redis://localhost:6379/0"
    wechat_app_id: str | None = Field(default=None, min_length=1, max_length=64)
    wechat_app_secret: SecretStr | None = None
    wechat_timeout_seconds: float = Field(default=5.0, gt=0, le=30)
    tencent_map_key: SecretStr | None = None
    weather_timeout_seconds: float = Field(default=5.0, gt=0, le=15)
    weather_max_bytes: int = Field(default=512 * 1024, ge=1024, le=3 * 1024 * 1024)
    ai_service_base_url: str | None = None
    ai_service_api_key: SecretStr | None = None
    ai_service_timeout_seconds: float = Field(default=5.0, gt=0, le=15)
    ai_service_max_response_bytes: int = Field(default=1048576, ge=1024, le=1048576)
    media_root: Path = Path("var/media")
    media_max_bytes: int = Field(default=10 * 1024 * 1024, ge=1, le=10 * 1024 * 1024)
    media_max_pixels: int = Field(default=25_000_000, ge=1, le=25_000_000)
    media_max_dimension: int = Field(default=8192, ge=1, le=8192)
    model_config = SettingsConfigDict(env_file=".env")

    @field_validator(
        "wechat_app_id",
        "wechat_app_secret",
        "tencent_map_key",
        "ai_service_base_url",
        "ai_service_api_key",
        mode="before",
    )
    @classmethod
    def empty_wechat_credentials_are_unconfigured(cls, value: object) -> object:
        text = value.get_secret_value() if isinstance(value, SecretStr) else value
        if isinstance(text, str) and not text.strip():
            return None
        # 非空凭据原样交给提供方，避免配置边界悄悄改变身份或 Secret。
        return value


settings = Settings()
