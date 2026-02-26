"""交易引擎：风控与执行模块测试。"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from trading_engine.config import EngineSettings
from trading_engine.execution_engine import ExecutionEngine
from trading_engine.models import Fill, Order, OrderBook, OrderBookLevel, OrderIntent, Position, Side, StrategyState
from trading_engine.risk_manager import RiskManager


class FakeMarketData:
    def __init__(self, slippage: float = 0.001, orderbook: OrderBook | None = None) -> None:
        self._slippage = slippage
        self._orderbook = orderbook

    async def estimate_slippage(self, symbol: str, side: Side, size: float) -> float:
        return self._slippage

    async def get_orderbook(self, symbol: str) -> OrderBook | None:
        return self._orderbook


@pytest.mark.asyncio
async def test_risk_manager_blocks_by_market_exposure() -> None:
    settings = EngineSettings(max_market_exposure=100, max_total_exposure=500, max_bucket_position=20)
    rm = RiskManager(settings)
    state = StrategyState()

    intent = OrderIntent(market_id="m1", bucket_id="b1", side=Side.BUY, price=0.8, size=200)
    decision = await rm.pre_trade_check(intent, state)

    assert decision.allowed is False
    assert decision.reason == "market_exposure_cap"


@pytest.mark.asyncio
async def test_risk_manager_emergency_stop_halts_trading() -> None:
    settings = EngineSettings()
    rm = RiskManager(settings)
    state = StrategyState()

    await rm.emergency_stop("manual")
    intent = OrderIntent(market_id="m1", bucket_id="b1", side=Side.BUY, price=0.5, size=1)
    decision = await rm.pre_trade_check(intent, state)

    assert decision.allowed is False
    assert decision.reason == "manual"


@pytest.mark.asyncio
async def test_execution_engine_dry_run_fills_crossing_order() -> None:
    settings = EngineSettings(dry_run=True)
    orderbook = OrderBook(
        symbol="bucket1",
        bids=[OrderBookLevel(price=0.45, size=10)],
        asks=[OrderBookLevel(price=0.40, size=10)],
    )
    market_data = FakeMarketData(slippage=0.001, orderbook=orderbook)
    engine = ExecutionEngine(settings, market_data)  # type: ignore[arg-type]

    intent = OrderIntent(market_id="m1", bucket_id="bucket1", side=Side.BUY, price=0.42, size=5)
    order = await engine.submit_intent(intent, max_slippage=0.01)

    assert order is not None
    assert order.filled_size == 5
    assert order.status.value == "filled"

    fills = await engine.fills()
    assert len(fills) == 1
    assert fills[0].price == 0.40


@pytest.mark.asyncio
async def test_execution_engine_skips_when_slippage_too_high() -> None:
    settings = EngineSettings(dry_run=True)
    market_data = FakeMarketData(slippage=0.2, orderbook=None)
    engine = ExecutionEngine(settings, market_data)  # type: ignore[arg-type]

    intent = OrderIntent(market_id="m1", bucket_id="bucket1", side=Side.BUY, price=0.42, size=5)
    order = await engine.submit_intent(intent, max_slippage=0.05)

    assert order is None
