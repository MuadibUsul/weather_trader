"""
风控模块。

职责：
1. 每笔下单前执行风控校验（敞口、库存、熔断）。
2. 成交后更新权益与回撤状态。
3. 提供风控快照给 API/前端。
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, Optional

from .config import EngineSettings
from .models import Fill, OrderIntent, Position, RiskSnapshot, Side, StrategyState


@dataclass(slots=True)
class RiskDecision:
    """风控检查结果。"""
    allowed: bool
    reason: str = ""


class RiskManager:
    """统一风控控制器。"""

    def __init__(self, settings: EngineSettings) -> None:
        self.settings = settings
        self._halted = False
        self._halt_reason = ""
        self._peak_equity = 0.0
        self._equity = 0.0
        self._volatility_flag = False
        self._lock = asyncio.Lock()

    async def emergency_stop(self, reason: str) -> None:
        """人工紧急停机。"""
        async with self._lock:
            self._halted = True
            self._halt_reason = reason

    async def set_volatility_spike(self, flag: bool) -> None:
        """波动熔断开关。"""
        async with self._lock:
            self._volatility_flag = flag
            if flag:
                self._halted = True
                self._halt_reason = "volatility_spike"

    async def pre_trade_check(self, intent: OrderIntent, state: StrategyState) -> RiskDecision:
        """交易前风险检查。"""
        async with self._lock:
            if self._halted:
                return RiskDecision(False, self._halt_reason)
            if self._volatility_flag:
                return RiskDecision(False, "volatility_spike")

            market_exposure = self._market_exposure(state)
            proposed_notional = intent.price * intent.size

            if market_exposure.get(intent.market_id, 0.0) + proposed_notional > self.settings.max_market_exposure:
                return RiskDecision(False, "market_exposure_cap")

            total = sum(market_exposure.values()) + proposed_notional
            if total > self.settings.max_total_exposure:
                return RiskDecision(False, "total_exposure_cap")

            pos_key = f"{intent.market_id}:{intent.bucket_id}"
            existing = state.positions.get(pos_key, Position(market_id=intent.market_id, bucket_id=intent.bucket_id))
            signed_add = intent.size if intent.side == Side.BUY else -intent.size
            if abs(existing.quantity + signed_add) > self.settings.max_bucket_position:
                return RiskDecision(False, "bucket_inventory_limit")

            return RiskDecision(True)

    async def on_fill(self, fill: Fill) -> None:
        """成交后更新权益与回撤。"""
        async with self._lock:
            signed = fill.size if fill.side == Side.SELL else -fill.size
            self._equity += signed * fill.price
            self._peak_equity = max(self._peak_equity, self._equity)
            dd = self._current_drawdown_locked()
            if dd > self.settings.max_drawdown_pct:
                self._halted = True
                self._halt_reason = "drawdown_limit"

    async def snapshot(self, state: StrategyState) -> RiskSnapshot:
        """输出风控快照。"""
        async with self._lock:
            market_exp = self._market_exposure(state)
            return RiskSnapshot(
                total_exposure=sum(market_exp.values()),
                market_exposure=market_exp,
                max_drawdown=self._current_drawdown_locked(),
                halted=self._halted,
                halt_reason=self._halt_reason,
            )

    def _market_exposure(self, state: StrategyState) -> Dict[str, float]:
        """统计市场维度敞口（仓位 + 挂单）。"""
        exposure = defaultdict(float)
        for pos in state.positions.values():
            exposure[pos.market_id] += abs(pos.quantity * pos.avg_price)
        for order in state.open_orders.values():
            exposure[order.market_id] += abs((order.size - order.filled_size) * order.price)
        return dict(exposure)

    def _current_drawdown_locked(self) -> float:
        """在持锁场景下计算当前回撤。"""
        if self._peak_equity <= 0:
            return 0.0
        return max(0.0, (self._peak_equity - self._equity) / self._peak_equity)
