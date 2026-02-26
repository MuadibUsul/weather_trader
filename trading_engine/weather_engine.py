"""
天气数据引擎。

职责说明：
1. 解析 Polymarket 结算链接，提取气象站点与交易日期。
2. 拉取观测数据与小时预报，构造当日温度关键特征。
3. 统一时区并输出稳定的 WeatherSnapshot，供概率模型直接使用。
4. 提供缓存与重试，降低外部 API 抖动对实盘主循环的影响。
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Dict, Optional, Tuple
from zoneinfo import ZoneInfo

import aiohttp
from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from .config import EngineSettings
from .models import WeatherSnapshot

logger = logging.getLogger(__name__)


def parse_iso(value: str) -> datetime:
    """解析 ISO 时间字符串，兼容以 Z 结尾的 UTC 表达。"""
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def parse_resolution_url(url: str) -> Tuple[str, datetime]:
    """从 Wunderground 结算 URL 提取站点代码和日期。"""
    cleaned = url.rstrip("/")
    date_match = re.search(r"/date/(\d{4}-\d{2}-\d{2})", cleaned)
    if not date_match:
        raise ValueError(f"resolution url missing date segment: {url}")
    date_value = datetime.fromisoformat(date_match.group(1)).replace(tzinfo=UTC)

    station_match = re.search(r"/daily/([^/]+)/date/", cleaned)
    if station_match:
        station = station_match.group(1).upper()
    else:
        station = cleaned.split("/")[-3].upper()
    return station, date_value


@dataclass(slots=True)
class CacheItem:
    expires_at: datetime
    payload: WeatherSnapshot


class WeatherDataEngine:
    """天气数据引擎：负责采集、清洗、特征生成与缓存。"""

    def __init__(self, settings: EngineSettings, session: Optional[aiohttp.ClientSession] = None) -> None:
        self.settings = settings
        self._session = session
        self._cache: Dict[str, CacheItem] = {}
        self._lock = asyncio.Lock()

    async def _get_session(self) -> aiohttp.ClientSession:
        """懒加载 aiohttp 会话，避免重复建立连接池。"""
        if self._session and not self._session.closed:
            return self._session
        timeout = aiohttp.ClientTimeout(total=15)
        self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self) -> None:
        """释放底层 HTTP 会话。"""
        if self._session and not self._session.closed:
            await self._session.close()

    async def fetch_snapshot(self, resolution_url: str) -> WeatherSnapshot:
        """
        获取某个市场对应的天气快照。

        关键输出字段：
        - t_max_sofar：当日截至当前时刻最高温
        - forecast_daily_max：预报日最高温
        - forecast_upper_bound：预报上界（尾部策略使用）
        - hours_remaining：距当日结束剩余小时
        """
        station, market_date_utc = parse_resolution_url(resolution_url)
        cache_key = f"{station}:{market_date_utc.date().isoformat()}"

        async with self._lock:
            cached = self._cache.get(cache_key)
            now = datetime.now(UTC)
            if cached and cached.expires_at > now:
                return cached.payload

        station_meta, observations, forecast = await asyncio.gather(
            self._fetch_station_meta(station),
            self._fetch_observations(station),
            self._fetch_forecast_hourly_for_station(station),
        )

        tz_name = station_meta.get("properties", {}).get("timeZone") or forecast.get("properties", {}).get("timeZone") or "UTC"
        zone = ZoneInfo(tz_name)
        market_date_local = market_date_utc.astimezone(zone).date()

        t_max_sofar = self._compute_tmax_sofar(observations, market_date_local, zone)
        forecast_daily_max, forecast_upper_bound = self._compute_forecast_metrics(forecast, market_date_local, zone, t_max_sofar)

        now_local = datetime.now(zone)
        settlement_local = datetime.combine(market_date_local, datetime.max.time(), tzinfo=zone)
        hours_remaining = max(0.0, (settlement_local - now_local).total_seconds() / 3600.0)

        quality = "ok"
        if t_max_sofar is None:
            t_max_sofar = forecast_daily_max
            quality = "fallback_forecast_only"

        snapshot = WeatherSnapshot(
            station=station,
            market_date=datetime.combine(market_date_local, datetime.min.time(), tzinfo=zone),
            timezone=tz_name,
            t_max_sofar=float(t_max_sofar),
            forecast_daily_max=float(forecast_daily_max),
            forecast_upper_bound=float(forecast_upper_bound),
            hours_remaining=hours_remaining,
            last_update=datetime.now(UTC),
            quality_flag=quality,
        )

        async with self._lock:
            self._cache[cache_key] = CacheItem(
                # 当前实现采用内存 TTL；如需跨进程共享可替换为 Redis。
                expires_at=datetime.now(UTC).replace(microsecond=0) + (snapshot.last_update - snapshot.last_update) + timedelta_seconds(self.settings.weather_refresh_seconds),
                payload=snapshot,
            )
        return snapshot

    async def _fetch_json(self, url: str) -> Dict[str, Any]:
        """统一 GET + 指数退避重试。"""
        session = await self._get_session()
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(4),
            wait=wait_exponential(multiplier=0.5, min=0.5, max=4),
            retry=retry_if_exception_type((aiohttp.ClientError, asyncio.TimeoutError)),
            reraise=True,
        ):
            with attempt:
                async with session.get(url, headers={"User-Agent": "weather-trader/1.0"}) as resp:
                    resp.raise_for_status()
                    return await resp.json()
        raise RuntimeError("unreachable")

    async def _fetch_station_meta(self, station: str) -> Dict[str, Any]:
        """拉取站点元信息（时区/经纬度等）。"""
        url = f"{self.settings.weather_api_base_url}/stations/{station}"
        return await self._fetch_json(url)

    async def _fetch_observations(self, station: str) -> Dict[str, Any]:
        """拉取近期观测数据，后续计算当日最高温。"""
        url = f"{self.settings.weather_api_base_url}/stations/{station}/observations?limit=96"
        return await self._fetch_json(url)

    async def _fetch_forecast_hourly_for_station(self, station: str) -> Dict[str, Any]:
        """通过 points 接口发现小时预报地址并拉取数据。"""
        station_data = await self._fetch_station_meta(station)
        coords = station_data.get("geometry", {}).get("coordinates", [0, 0])
        lon, lat = coords[0], coords[1]
        points = await self._fetch_json(f"{self.settings.weather_api_base_url}/points/{lat},{lon}")
        forecast_url = points.get("properties", {}).get("forecastHourly")
        if not forecast_url:
            raise ValueError(f"missing forecastHourly endpoint for station {station}")
        return await self._fetch_json(forecast_url)

    def _compute_tmax_sofar(self, observations: Dict[str, Any], market_date_local, zone: ZoneInfo) -> Optional[float]:
        """筛选交易日观测并返回最高温。"""
        values = []
        for feature in observations.get("features", []):
            props = feature.get("properties", {})
            timestamp = props.get("timestamp")
            temp_block = props.get("temperature", {})
            value_c = temp_block.get("value")
            if timestamp is None or value_c is None:
                continue
            obs_time = parse_iso(timestamp).astimezone(zone)
            if obs_time.date() != market_date_local:
                continue
            values.append(float(value_c))
        if not values:
            return None
        return max(values)

    def _compute_forecast_metrics(self, forecast: Dict[str, Any], market_date_local, zone: ZoneInfo, t_max_sofar: Optional[float]) -> Tuple[float, float]:
        """计算预报最高温与保守上界。"""
        forecast_vals = []
        for period in forecast.get("properties", {}).get("periods", []):
            start = period.get("startTime")
            temp = period.get("temperature")
            unit = period.get("temperatureUnit", "F")
            if start is None or temp is None:
                continue
            local_time = parse_iso(start).astimezone(zone)
            if local_time.date() != market_date_local:
                continue
            temp_c = (float(temp) - 32.0) * 5.0 / 9.0 if unit.upper() == "F" else float(temp)
            forecast_vals.append(temp_c)

        if not forecast_vals:
            fallback = t_max_sofar if t_max_sofar is not None else 20.0
            return fallback, fallback + 1.0

        fmax = max(forecast_vals)
        base = max(fmax, t_max_sofar) if t_max_sofar is not None else fmax
        spread = max(1.0, 0.25 * (max(forecast_vals) - min(forecast_vals) + 1.0))
        upper = base + spread
        return base, upper


def timedelta_seconds(seconds: int):
    """辅助函数：以秒构造 timedelta。"""
    from datetime import timedelta

    return timedelta(seconds=seconds)
