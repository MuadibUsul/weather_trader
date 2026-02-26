"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"

    database_url: str = "postgresql+asyncpg://weather:weather@localhost:5432/weather_trader"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 720


@lru_cache(maxsize=1)
def get_settings() -> AppSettings:
    return AppSettings()