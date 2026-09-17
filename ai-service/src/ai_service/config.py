"""Validated service configuration; no credentials are baked into the package."""
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    api_key: SecretStr = Field(min_length=24)
    scope: str = Field(default="local", min_length=1, max_length=128)
    poll_interval: float = Field(default=0.5, gt=0, le=60)
    model_config = SettingsConfigDict(env_prefix="AI_", env_file=".env", extra="ignore")

    @field_validator("database_url")
    @classmethod
    def postgres_only(cls, value: str) -> str:
        if not value.startswith(("postgresql://", "postgres://")):
            raise ValueError("AI_DATABASE_URL must be a PostgreSQL connection URL")
        return value
