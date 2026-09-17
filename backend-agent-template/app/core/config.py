from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    redis_url: str = "redis://localhost:6379/0"
    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
