"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class EngineSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    database_url: str = "postgresql+asyncpg://weather:weather@localhost:5432/weather_trader"
    redis_url: str = "redis://localhost:6379/0"

    polymarket_ws_url: str = "wss://clob.polymarket.com/ws"
    polymarket_rest_url: str = "https://clob.polymarket.com"
    polymarket_api_key: str = ""
    polymarket_secret: str = ""
    polymarket_passphrase: str = ""

    weather_api_base_url: str = "https://api.weather.gov"
    wunderground_base_url: str = "https://www.wunderground.com/history/daily"

    engine_loop_interval_seconds: float = 5.0
    weather_refresh_seconds: int = 300
    market_subscribe_symbols: str = ""
    dry_run: bool = True

    max_market_exposure: float = 2500.0
    max_total_exposure: float = 10000.0
    max_bucket_position: float = 1000.0
    max_drawdown_pct: float = 0.15
    max_spread: float = 0.08
    min_liquidity_depth: float = 200.0

    edge_threshold: float = 0.03
    transaction_cost_buffer: float = 0.01
    tail_minutes: int = 180

    model_sigma0: float = 3.5
    model_decay_k: float = 0.09

    @property
    def symbols(self) -> List[str]:
        return [s.strip() for s in self.market_subscribe_symbols.split(",") if s.strip()]


@lru_cache(maxsize=1)
def get_engine_settings() -> EngineSettings:
    return EngineSettings()