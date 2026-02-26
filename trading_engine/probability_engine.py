"""
概率分布引擎。

将天气状态映射为“温度桶概率分布”，输出信号引擎所需的 p_model。
CPU 密集计算放入线程池，避免阻塞 asyncio 事件循环。
"""

from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Iterable, List

from .config import EngineSettings
from .models import BucketRange, WeatherSnapshot


class ProbabilityEngine:
    """天气特征到桶概率的映射器。"""

    def __init__(self, settings: EngineSettings) -> None:
        self.settings = settings
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="prob-model")

    async def compute_distribution(self, weather: WeatherSnapshot, buckets: Iterable[BucketRange]) -> Dict[str, float]:
        """异步入口：在线程池执行同步模型计算。"""
        import asyncio

        loop = asyncio.get_running_loop()
        bucket_list = list(buckets)
        return await loop.run_in_executor(self._executor, self._compute_distribution_sync, weather, bucket_list)

    def _compute_distribution_sync(self, weather: WeatherSnapshot, buckets: List[BucketRange]) -> Dict[str, float]:
        """同步建模核心：动态 sigma + CDF 差分 + 概率归一化。"""
        hours = max(0.0, weather.hours_remaining)
        sigma = max(0.35, self.settings.model_sigma0 * math.exp(-self.settings.model_decay_k * (24 - min(24.0, hours))))

        # 临近结算时提高观测最高温权重，增强模型稳定性。
        obs_weight = 1.0 - min(1.0, hours / 24.0)
        mu = max(weather.t_max_sofar, (obs_weight * weather.t_max_sofar) + ((1.0 - obs_weight) * weather.forecast_daily_max))

        probs: Dict[str, float] = {}
        for bucket in buckets:
            upper_prob = self._normal_cdf((bucket.upper - mu) / sigma)
            lower_prob = self._normal_cdf((bucket.lower - mu) / sigma)
            p = max(0.0, upper_prob - lower_prob)
            probs[bucket.bucket_id] = p

        total = sum(probs.values())
        if total <= 1e-12:
            uniform = 1.0 / max(1, len(buckets))
            return {b.bucket_id: uniform for b in buckets}
        return {k: v / total for k, v in probs.items()}

    def _normal_cdf(self, z: float) -> float:
        """标准正态分布 CDF。"""
        return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))
