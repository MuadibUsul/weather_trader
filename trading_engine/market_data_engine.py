"""
市场数据引擎。

职责：
1. 订阅 CLOB WebSocket 并维护本地订单簿。
2. 处理快照与增量消息，构建稳定盘口状态。
3. 为执行层提供滑点估算等微观结构指标。
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any, Dict, Iterable, List, Optional

import websockets

from .config import EngineSettings
from .models import OrderBook, OrderBookLevel, Side

logger = logging.getLogger(__name__)


class MarketDataEngine:
    """盘口订阅与本地订单簿维护器。"""

    def __init__(self, settings: EngineSettings) -> None:
        self.settings = settings
        self._orderbooks: Dict[str, OrderBook] = {}
        self._lock = asyncio.Lock()
        self._stop_event = asyncio.Event()
        self._task: Optional[asyncio.Task] = None

    async def start(self, symbols: Iterable[str]) -> None:
        """启动盘口流任务。"""
        if self._task and not self._task.done():
            return
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_stream(list(symbols)), name="market_ws")

    async def stop(self) -> None:
        """停止盘口流任务。"""
        self._stop_event.set()
        if self._task:
            await self._task

    async def get_orderbook(self, symbol: str) -> Optional[OrderBook]:
        """获取指定 symbol 的盘口副本。"""
        async with self._lock:
            ob = self._orderbooks.get(symbol)
            if ob is None:
                return None
            return OrderBook(symbol=ob.symbol, bids=list(ob.bids), asks=list(ob.asks), updated_at=ob.updated_at)

    async def all_orderbooks(self) -> Dict[str, OrderBook]:
        """获取全部盘口副本。"""
        async with self._lock:
            return {
                k: OrderBook(symbol=v.symbol, bids=list(v.bids), asks=list(v.asks), updated_at=v.updated_at)
                for k, v in self._orderbooks.items()
            }

    async def estimate_slippage(self, symbol: str, side: Side, size: float) -> float:
        """按当前深度估算给定 size 的滑点。"""
        ob = await self.get_orderbook(symbol)
        if not ob:
            return 1.0
        levels = ob.asks if side == Side.BUY else ob.bids
        remaining = size
        cost = 0.0
        consumed = 0.0
        for lvl in levels:
            take = min(lvl.size, remaining)
            if take <= 0:
                break
            remaining -= take
            consumed += take
            cost += take * lvl.price
        if consumed <= 0 or remaining > 1e-9:
            return 1.0
        vwap = cost / consumed
        return abs(vwap - ob.mid())

    async def _run_stream(self, symbols: List[str]) -> None:
        """WebSocket 长连循环，异常自动重连。"""
        payload = {
            "type": "subscribe",
            "channel": "market",
            "symbols": symbols,
        }
        while not self._stop_event.is_set():
            try:
                async with websockets.connect(self.settings.polymarket_ws_url, ping_interval=20, ping_timeout=20) as ws:
                    await ws.send(json.dumps(payload))
                    logger.info("market data stream connected", extra={"symbols": symbols})
                    async for raw in ws:
                        if self._stop_event.is_set():
                            break
                        msg = json.loads(raw)
                        await self._handle_message(msg)
            except Exception:
                logger.exception("market websocket failure; reconnecting")
                await asyncio.sleep(2)

    async def _handle_message(self, msg: Dict[str, Any]) -> None:
        """处理快照消息与增量消息。"""
        event = msg.get("event") or msg.get("type")
        if event in {"snapshot", "book"}:
            symbol = msg.get("symbol") or msg.get("market")
            if not symbol:
                return
            bids = self._parse_levels(msg.get("bids", []))
            asks = self._parse_levels(msg.get("asks", []), reverse=False)
            await self._set_orderbook(symbol, bids, asks)
            return

        if event in {"l2update", "delta", "update"}:
            symbol = msg.get("symbol") or msg.get("market")
            if not symbol:
                return
            bids_delta = self._parse_levels(msg.get("bids", []))
            asks_delta = self._parse_levels(msg.get("asks", []), reverse=False)
            await self._apply_delta(symbol, bids_delta, asks_delta)

    def _parse_levels(self, levels: List[Any], reverse: bool = True) -> List[OrderBookLevel]:
        """兼容多种消息格式并排序。"""
        parsed: List[OrderBookLevel] = []
        for item in levels:
            if isinstance(item, dict):
                p = item.get("price")
                s = item.get("size") or item.get("quantity")
            else:
                p = item[0] if len(item) > 0 else None
                s = item[1] if len(item) > 1 else None
            if p is None or s is None:
                continue
            parsed.append(OrderBookLevel(price=float(p), size=float(s)))
        parsed.sort(key=lambda x: x.price, reverse=reverse)
        return parsed

    async def _set_orderbook(self, symbol: str, bids: List[OrderBookLevel], asks: List[OrderBookLevel]) -> None:
        """写入全量快照。"""
        async with self._lock:
            self._orderbooks[symbol] = OrderBook(symbol=symbol, bids=bids, asks=asks, updated_at=datetime.now(UTC))

    async def _apply_delta(self, symbol: str, bids_delta: List[OrderBookLevel], asks_delta: List[OrderBookLevel]) -> None:
        """合并增量档位。"""
        async with self._lock:
            ob = self._orderbooks.get(symbol)
            if ob is None:
                ob = OrderBook(symbol=symbol)
                self._orderbooks[symbol] = ob
            ob.bids = self._merge_levels(ob.bids, bids_delta, desc=True)
            ob.asks = self._merge_levels(ob.asks, asks_delta, desc=False)
            ob.updated_at = datetime.now(UTC)

    def _merge_levels(self, current: List[OrderBookLevel], delta: List[OrderBookLevel], desc: bool) -> List[OrderBookLevel]:
        """以价格为键合并档位，并截断到前 20 档。"""
        table = {round(l.price, 6): l.size for l in current}
        for d in delta:
            key = round(d.price, 6)
            if d.size <= 0:
                table.pop(key, None)
            else:
                table[key] = d.size
        levels = [OrderBookLevel(price=p, size=s) for p, s in table.items()]
        levels.sort(key=lambda x: x.price, reverse=desc)
        return levels[:20]
