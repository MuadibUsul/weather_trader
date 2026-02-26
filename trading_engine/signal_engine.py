"""
信号引擎。

核心流程：
1. 计算 edge = p_model - p_market。
2. 通过阈值、点差、流动性过滤器筛选可交易桶。
3. 输出 BUY/SELL 信号与目标价格。
"""

from __future__ import annotations

from typing import Dict, List

from .config import EngineSettings
from .models import MarketBucketQuote, Side, Signal, WeatherSnapshot


class SignalEngine:
    """将模型概率差异转为交易信号。"""

    def __init__(self, settings: EngineSettings) -> None:
        self.settings = settings

    def generate_signals(
        self,
        weather: WeatherSnapshot,
        model_probs: Dict[str, float],
        quotes: List[MarketBucketQuote],
    ) -> List[Signal]:
        """按桶生成信号。"""
        signals: List[Signal] = []
        base_threshold = self.settings.edge_threshold + self.settings.transaction_cost_buffer
        tail_window_hours = self.settings.tail_minutes / 60.0

        for quote in quotes:
            ob = quote.orderbook
            spread = ob.spread()
            depth = ob.depth_within(spread_width=0.08)
            if spread > self.settings.max_spread:
                continue
            if depth < self.settings.min_liquidity_depth:
                continue

            bucket_id = quote.bucket.bucket_id
            p_model = model_probs.get(bucket_id, 0.0)
            p_market = quote.implied_probability
            edge = p_model - p_market

            strategy_reason = "intraday_mispricing"
            if weather.hours_remaining <= tail_window_hours:
                # 临近结算阶段的信号归类为尾盘收敛策略。
                strategy_reason = "tail_convergence"

            if edge >= base_threshold:
                confidence = min(1.0, edge / (base_threshold * 2.0))
                signals.append(
                    Signal(
                        market_id=quote.market_id,
                        bucket_id=bucket_id,
                        side=Side.BUY,
                        edge=edge,
                        model_probability=p_model,
                        market_probability=p_market,
                        target_price=max(0.01, min(0.99, p_model - spread / 2.0)),
                        confidence=confidence,
                        reason=strategy_reason,
                    )
                )
            elif -edge >= base_threshold:
                confidence = min(1.0, (-edge) / (base_threshold * 2.0))
                signals.append(
                    Signal(
                        market_id=quote.market_id,
                        bucket_id=bucket_id,
                        side=Side.SELL,
                        edge=-edge,
                        model_probability=p_model,
                        market_probability=p_market,
                        target_price=max(0.01, min(0.99, p_model + spread / 2.0)),
                        confidence=confidence,
                        reason=strategy_reason,
                    )
                )

        return signals
