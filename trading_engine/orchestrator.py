"""
策略编排器（主循环）。

职责：
1. 统一调度天气更新、信号生成、风控检查与订单执行。
2. 聚合仓位、挂单、成交与指标状态，向 API 层提供可查询状态。
3. 管理策略生命周期（启动/停止/关闭）与参数热更新。
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Dict, List, Optional

from .config import EngineSettings, get_engine_settings
from .execution_engine import ExecutionEngine
from .logging_utils import set_correlation_id
from .market_data_engine import MarketDataEngine
from .models import BucketRange, MarketBucketQuote, OrderIntent, Position, StrategyState
from .probability_engine import ProbabilityEngine
from .risk_manager import RiskManager
from .signal_engine import SignalEngine
from .weather_engine import WeatherDataEngine

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class MarketDefinition:
    """市场定义：市场 ID、结算链接、温度桶配置。"""
    market_id: str
    resolution_url: str
    buckets: List[BucketRange]


@dataclass(slots=True)
class StrategyConfig:
    """策略运行参数。"""
    order_size: float = 25.0
    quote_delta: float = 0.01
    enabled: bool = False
    dry_run: bool = True


class StrategyOrchestrator:
    """交易系统核心调度器。"""

    def __init__(self, settings: Optional[EngineSettings] = None) -> None:
        self.settings = settings or get_engine_settings()
        self.market_data = MarketDataEngine(self.settings)
        self.weather = WeatherDataEngine(self.settings)
        self.probability = ProbabilityEngine(self.settings)
        self.signal_engine = SignalEngine(self.settings)
        self.risk = RiskManager(self.settings)
        self.execution = ExecutionEngine(self.settings, self.market_data)

        self.state = StrategyState()
        self.config = StrategyConfig(dry_run=self.settings.dry_run)
        self.markets: Dict[str, MarketDefinition] = {}
        self._weather_cache: Dict[str, object] = {}
        self._task: Optional[asyncio.Task] = None
        self._state_lock = asyncio.Lock()

    async def register_market(self, market: MarketDefinition) -> None:
        """注册可交易市场。"""
        self.markets[market.market_id] = market

    async def start(self) -> None:
        """启动策略循环与盘口订阅。"""
        async with self._state_lock:
            if self.state.running:
                return
            self.state.running = True
            self.state.started_at = datetime.now(UTC)

        symbols = [bucket.bucket_id for market in self.markets.values() for bucket in market.buckets]
        await self.market_data.start(symbols)
        self._task = asyncio.create_task(self._main_loop(), name="strategy_orchestrator")

    async def stop(self) -> None:
        """停止策略循环。"""
        async with self._state_lock:
            self.state.running = False
        if self._task:
            await self._task
        await self.market_data.stop()

    async def close(self) -> None:
        """关闭 orchestrator 管理的全部资源。"""
        await self.stop()
        await self.execution.close()
        await self.weather.close()

    async def update_config(self, order_size: Optional[float] = None, quote_delta: Optional[float] = None, dry_run: Optional[bool] = None) -> StrategyConfig:
        """更新参数并做边界保护。"""
        if order_size is not None:
            self.config.order_size = max(1.0, float(order_size))
        if quote_delta is not None:
            self.config.quote_delta = min(0.1, max(0.001, float(quote_delta)))
        if dry_run is not None:
            self.config.dry_run = bool(dry_run)
            self.settings.dry_run = self.config.dry_run
        return self.config

    async def status(self) -> Dict[str, object]:
        """返回策略聚合状态，供前端与监控调用。"""
        risk_snapshot = await self.risk.snapshot(self.state)
        fills = await self.execution.fills()
        return {
            "running": self.state.running,
            "started_at": self.state.started_at.isoformat() if self.state.started_at else None,
            "market_count": len(self.markets),
            "open_orders": len(self.state.open_orders),
            "positions": [vars(p) for p in self.state.positions.values()],
            "metrics": vars(self.state.metrics),
            "risk": {
                "total_exposure": risk_snapshot.total_exposure,
                "max_drawdown": risk_snapshot.max_drawdown,
                "halted": risk_snapshot.halted,
                "halt_reason": risk_snapshot.halt_reason,
            },
            "fill_count": len(fills),
            "config": vars(self.config),
        }

    async def _main_loop(self) -> None:
        """主事件循环：刷新天气 -> 评估交易 -> sleep。"""
        next_weather_refresh = datetime.now(UTC)

        while True:
            async with self._state_lock:
                if not self.state.running:
                    break

            set_correlation_id()
            now = datetime.now(UTC)

            if now >= next_weather_refresh:
                await self._refresh_weather_all()
                next_weather_refresh = now.replace(microsecond=0) + timedelta_seconds(self.settings.weather_refresh_seconds)

            await self._evaluate_and_trade_cycle()
            await asyncio.sleep(self.settings.engine_loop_interval_seconds)

    async def _refresh_weather_all(self) -> None:
        """并发刷新全部市场天气快照。"""
        if not self.markets:
            return
        tasks = [self.weather.fetch_snapshot(m.resolution_url) for m in self.markets.values()]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        for market_id, result in zip(self.markets.keys(), results):
            if isinstance(result, Exception):
                logger.exception("weather refresh failure", extra={"market_id": market_id})
                continue
            self._weather_cache[market_id] = result

    async def _evaluate_and_trade_cycle(self) -> None:
        """逐市场执行模型、信号、风控和下单。"""
        for market in self.markets.values():
            weather_snapshot = self._weather_cache.get(market.market_id)
            if weather_snapshot is None:
                continue

            distribution = await self.probability.compute_distribution(weather_snapshot, market.buckets)
            quotes: List[MarketBucketQuote] = []
            for bucket in market.buckets:
                ob = await self.market_data.get_orderbook(bucket.bucket_id)
                if not ob:
                    continue
                quotes.append(MarketBucketQuote(market_id=market.market_id, bucket=bucket, orderbook=ob))

            signals = self.signal_engine.generate_signals(weather_snapshot, distribution, quotes)
            for signal in signals:
                size = self.config.order_size * max(0.2, signal.confidence)
                quote_delta = self.config.quote_delta
                target = signal.target_price
                if signal.side.value == "buy":
                    price = max(0.01, target - quote_delta)
                else:
                    price = min(0.99, target + quote_delta)

                intent = OrderIntent(
                    market_id=signal.market_id,
                    bucket_id=signal.bucket_id,
                    side=signal.side,
                    price=price,
                    size=size,
                )

                decision = await self.risk.pre_trade_check(intent, self.state)
                if not decision.allowed:
                    logger.info("risk blocked trade", extra={"reason": decision.reason, "bucket": signal.bucket_id})
                    continue

                # 滑点约束必须小于 edge 的一半，避免成本吞噬信号价值。
                max_slippage = max(0.0025, signal.edge / 2.0)
                order = await self.execution.submit_intent(intent, max_slippage=max_slippage)
                if not order:
                    continue

                self.state.open_orders[order.order_id] = order
                await self._sync_fills()

    async def _sync_fills(self) -> None:
        """同步成交到仓位与指标，并触发风控权益更新。"""
        fills = await self.execution.fills()
        if not fills:
            return

        processed = getattr(self, "_processed_fill_ids", set())
        for fill in fills:
            key = f"{fill.order_id}:{fill.ts.isoformat()}:{fill.size}"
            if key in processed:
                continue
            processed.add(key)
            pos_key = f"{fill.market_id}:{fill.bucket_id}"
            position = self.state.positions.get(pos_key)
            if not position:
                position = Position(market_id=fill.market_id, bucket_id=fill.bucket_id)
                self.state.positions[pos_key] = position
            position.update(fill)
            self.state.metrics.fill_count += 1
            await self.risk.on_fill(fill)
        self._processed_fill_ids = processed

        open_orders = await self.execution.open_orders()
        self.state.open_orders = open_orders


def timedelta_seconds(seconds: int):
    """辅助函数：以秒构造 timedelta。"""
    from datetime import timedelta

    return timedelta(seconds=seconds)
