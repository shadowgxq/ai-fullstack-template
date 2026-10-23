"""Validated service configuration; no credentials are baked into the package."""

from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def model_base_url(value: str) -> str:
    """Trusted operator configuration only; never accept credentials or query data."""
    try:
        parsed = urlsplit(value)
        if (
            value != value.strip()
            or any(not 32 < ord(char) < 127 for char in value)
            or parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
            or "?" in value
            or "#" in value
            or "%" in value
            or "\\" in value
            or parsed.port == 0
            or parsed.path.rstrip("/") != "/v1"
        ):
            raise ValueError()
    except ValueError:
        raise ValueError(
            "Model base URL must be a trusted http/https origin with /v1"
        ) from None
    return value.rstrip("/")


class Settings(BaseSettings):
    database_url: str
    api_key: SecretStr = Field(min_length=24)
    scope: str = Field(default="local", min_length=1, max_length=128)
    poll_interval: float = Field(default=0.5, gt=0, le=60)
    model_enabled: bool = False
    model_name: str | None = Field(default=None, min_length=1, max_length=128)
    model_api_key: SecretStr | None = None
    model_base_url: str = Field(default="https://api.openai.com/v1", max_length=2048)
    model_response_transport: Literal["responses-json.v1", "responses-sse.v1"] = (
        "responses-json.v1"
    )
    model_reasoning_effort: (
        Literal["none", "minimal", "low", "medium", "high", "xhigh"] | None
    ) = None
    model_timeout_seconds: float = Field(default=20, gt=0, le=60)
    model_max_response_bytes: int = Field(default=1048576, ge=1024, le=1048576)
    model_max_output_tokens: int = Field(default=2048, ge=64, le=4096)
    model_config = SettingsConfigDict(
        env_prefix="AI_",
        env_file=(Path(__file__).resolve().parents[3] / ".env", ".env"),
        extra="ignore",
        hide_input_in_errors=True,
    )

    @field_validator("model_base_url")
    @classmethod
    def trusted_model_base_url(cls, value: str) -> str:
        return model_base_url(value)

    @field_validator("database_url")
    @classmethod
    def postgres_only(cls, value: str) -> str:
        if not value.startswith(("postgresql://", "postgres://")):
            raise ValueError("AI_DATABASE_URL must be a PostgreSQL connection URL")
        return value

    @field_validator(
        "model_name", "model_api_key", "model_reasoning_effort", mode="before"
    )
    @classmethod
    def empty_optional_model_configuration(cls, value):
        text = value.get_secret_value() if isinstance(value, SecretStr) else value
        return None if isinstance(text, str) and not text.strip() else value
