"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional


class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderStatus(str, Enum):
    NEW = "new"
    ACKED = "acked"
    PARTIAL = "partial"
    FILLED = "filled"
    CANCELED = "canceled"
    REJECTED = "rejected"


@dataclass(slots=True)
class BucketRange:
    bucket_id: str
    lower: float
    upper: float


@dataclass(slots=True)
class WeatherSnapshot:
    station: str
    market_date: datetime
    timezone: str
    t_max_sofar: float
    forecast_daily_max: float
    forecast_upper_bound: float
    hours_remaining: float
    last_update: datetime
    quality_flag: str = "ok"


@dataclass(slots=True)
class OrderBookLevel:
    price: float
    size: float


@dataclass(slots=True)
class OrderBook:
    symbol: str
    bids: List[OrderBookLevel] = field(default_factory=list)
    asks: List[OrderBookLevel] = field(default_factory=list)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def best_bid(self) -> Optional[OrderBookLevel]:
        return self.bids[0] if self.bids else None

    def best_ask(self) -> Optional[OrderBookLevel]:
        return self.asks[0] if self.asks else None

    def spread(self) -> float:
        bid = self.best_bid()
        ask = self.best_ask()
        if not bid or not ask:
            return 1.0
        return max(0.0, ask.price - bid.price)

    def mid(self) -> float:
        bid = self.best_bid()
        ask = self.best_ask()
        if bid and ask:
            return (bid.price + ask.price) / 2.0
        if bid:
            return bid.price
        if ask:
            return ask.price
        return 0.5

    def depth_within(self, spread_width: float) -> float:
        mid = self.mid()
        lower = mid - spread_width
        upper = mid + spread_width
        depth = 0.0
        for level in self.bids:
            if level.price >= lower:
                depth += level.size
        for level in self.asks:
            if level.price <= upper:
                depth += level.size
        return depth


@dataclass(slots=True)
class MarketBucketQuote:
    market_id: str
    bucket: BucketRange
    orderbook: OrderBook

    @property
    def implied_probability(self) -> float:
        return min(1.0, max(0.0, self.orderbook.mid()))


@dataclass(slots=True)
class Signal:
    market_id: str
    bucket_id: str
    side: Side
    edge: float
    model_probability: float
    market_probability: float
    target_price: float
    confidence: float
    reason: str


@dataclass(slots=True)
class OrderIntent:
    market_id: str
    bucket_id: str
    side: Side
    price: float
    size: float


@dataclass(slots=True)
class Order:
    order_id: str
    market_id: str
    bucket_id: str
    side: Side
    price: float
    size: float
    filled_size: float = 0.0
    status: OrderStatus = OrderStatus.NEW
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass(slots=True)
class Fill:
    order_id: str
    market_id: str
    bucket_id: str
    side: Side
    price: float
    size: float
    ts: datetime = field(default_factory=datetime.utcnow)


@dataclass(slots=True)
class Position:
    market_id: str
    bucket_id: str
    quantity: float = 0.0
    avg_price: float = 0.0

    def update(self, fill: Fill) -> None:
        signed = fill.size if fill.side == Side.BUY else -fill.size
        new_qty = self.quantity + signed
        if abs(new_qty) < 1e-9:
            self.quantity = 0.0
            self.avg_price = 0.0
            return
        if self.quantity == 0:
            self.quantity = signed
            self.avg_price = fill.price
            return
        if (self.quantity > 0 and signed > 0) or (self.quantity < 0 and signed < 0):
            self.avg_price = ((abs(self.quantity) * self.avg_price) + (abs(signed) * fill.price)) / abs(new_qty)
        self.quantity = new_qty


@dataclass(slots=True)
class RiskSnapshot:
    total_exposure: float
    market_exposure: Dict[str, float]
    max_drawdown: float
    halted: bool
    halt_reason: str = ""


@dataclass(slots=True)
class StrategyMetrics:
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    gross_exposure: float = 0.0
    net_exposure: float = 0.0
    win_rate: float = 0.0
    fill_count: int = 0
    rejection_count: int = 0


@dataclass(slots=True)
class StrategyState:
    running: bool = False
    started_at: Optional[datetime] = None
    metrics: StrategyMetrics = field(default_factory=StrategyMetrics)
    positions: Dict[str, Position] = field(default_factory=dict)
    open_orders: Dict[str, Order] = field(default_factory=dict)