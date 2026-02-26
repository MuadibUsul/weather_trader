"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd


class HistoricalDataLoader:
    def __init__(self, weather_path: str, market_path: str) -> None:
        self.weather_path = Path(weather_path)
        self.market_path = Path(market_path)

    def load(self) -> tuple[pd.DataFrame, pd.DataFrame]:
        weather = pd.read_csv(self.weather_path)
        market = pd.read_csv(self.market_path)

        weather["ts"] = pd.to_datetime(weather["ts"], utc=True)
        market["ts"] = pd.to_datetime(market["ts"], utc=True)

        weather = weather.sort_values("ts")
        market = market.sort_values("ts")
        return weather, market