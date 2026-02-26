"""交易引擎：概率模型与信号模块测试。"""

from __future__ import annotations

from datetime import UTC, datetime

from trading_engine.config import EngineSettings
from trading_engine.models import BucketRange, MarketBucketQuote, OrderBook, OrderBookLevel, WeatherSnapshot
from trading_engine.probability_engine import ProbabilityEngine
from trading_engine.signal_engine import SignalEngine


def _sample_weather(hours_remaining: float = 4.0) -> WeatherSnapshot:
    return WeatherSnapshot(
        station="KJFK",
        market_date=datetime.now(UTC),
        timezone="UTC",
        t_max_sofar=25.0,
        forecast_daily_max=27.0,
        forecast_upper_bound=29.0,
        hours_remaining=hours_remaining,
        last_update=datetime.now(UTC),
    )


async def test_probability_distribution_normalizes() -> None:
    settings = EngineSettings(model_sigma0=3.0, model_decay_k=0.08)
    engine = ProbabilityEngine(settings)
    buckets = [
        BucketRange(bucket_id="b1", lower=10, upper=20),
        BucketRange(bucket_id="b2", lower=20, upper=30),
        BucketRange(bucket_id="b3", lower=30, upper=40),
    ]

    probs = await engine.compute_distribution(_sample_weather(), buckets)

    assert set(probs.keys()) == {"b1", "b2", "b3"}
    assert abs(sum(probs.values()) - 1.0) < 1e-6
    assert probs["b2"] > probs["b1"]


def test_signal_engine_generates_buy_and_sell() -> None:
    settings = EngineSettings(
        edge_threshold=0.02,
        transaction_cost_buffer=0.01,
        max_spread=0.08,
        min_liquidity_depth=100,
        tail_minutes=180,
    )
    engine = SignalEngine(settings)

    weather = _sample_weather(hours_remaining=1.0)

    buy_book = OrderBook(
        symbol="bucket_buy",
        bids=[OrderBookLevel(price=0.35, size=120)],
        asks=[OrderBookLevel(price=0.37, size=140)],
    )
    sell_book = OrderBook(
        symbol="bucket_sell",
        bids=[OrderBookLevel(price=0.63, size=180)],
        asks=[OrderBookLevel(price=0.65, size=190)],
    )

    quotes = [
        MarketBucketQuote(
            market_id="m1",
            bucket=BucketRange(bucket_id="bucket_buy", lower=20, upper=25),
            orderbook=buy_book,
        ),
        MarketBucketQuote(
            market_id="m1",
            bucket=BucketRange(bucket_id="bucket_sell", lower=25, upper=30),
            orderbook=sell_book,
        ),
    ]

    model_probs = {
        "bucket_buy": 0.48,   # 高于市场中位约 0.36 -> BUY
        "bucket_sell": 0.42,  # 低于市场中位约 0.64 -> SELL
    }

    signals = engine.generate_signals(weather, model_probs, quotes)

    assert len(signals) == 2
    by_bucket = {s.bucket_id: s for s in signals}
    assert by_bucket["bucket_buy"].side.value == "buy"
    assert by_bucket["bucket_sell"].side.value == "sell"
    assert by_bucket["bucket_buy"].reason == "tail_convergence"
