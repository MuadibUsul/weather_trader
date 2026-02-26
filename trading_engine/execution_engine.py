"""
执行引擎（限价单）。

职责：
1. 接收交易意图并进行滑点约束检查。
2. 统一管理 dry-run 与实盘执行路径。
3. 维护订单状态与成交记录，支持撤单重挂。
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Dict, List, Optional

import aiohttp

from .config import EngineSettings
from .market_data_engine import MarketDataEngine
from .models import Fill, Order, OrderIntent, OrderStatus, Side

logger = logging.getLogger(__name__)


class ExecutionEngine:
    """订单生命周期管理器。"""

    def __init__(self, settings: EngineSettings, market_data: MarketDataEngine) -> None:
        self.settings = settings
        self.market_data = market_data
        self._session: Optional[aiohttp.ClientSession] = None
        self._orders: Dict[str, Order] = {}
        self._fills: List[Fill] = []
        self._lock = asyncio.Lock()

    async def _get_session(self) -> aiohttp.ClientSession:
        """懒加载 HTTP 会话。"""
        if self._session and not self._session.closed:
            return self._session
        self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10))
        return self._session

    async def close(self) -> None:
        """关闭 HTTP 会话。"""
        if self._session and not self._session.closed:
            await self._session.close()

    async def open_orders(self) -> Dict[str, Order]:
        """读取当前挂单快照。"""
        async with self._lock:
            return dict(self._orders)

    async def fills(self) -> List[Fill]:
        """读取当前成交快照。"""
        async with self._lock:
            return list(self._fills)

    async def submit_intent(self, intent: OrderIntent, max_slippage: float) -> Optional[Order]:
        """提交订单意图并执行下单。"""
        slippage = await self.market_data.estimate_slippage(intent.bucket_id, intent.side, intent.size)
        if slippage > max_slippage:
            logger.info(
                "skip order due to slippage constraint",
                extra={"bucket": intent.bucket_id, "slippage": slippage, "max_slippage": max_slippage},
            )
            return None

        order = Order(
            order_id=f"o_{uuid.uuid4().hex[:16]}",
            market_id=intent.market_id,
            bucket_id=intent.bucket_id,
            side=intent.side,
            price=round(intent.price, 4),
            size=round(intent.size, 4),
            status=OrderStatus.NEW,
        )

        if self.settings.dry_run:
            await self._simulate_order(order)
            return order

        created = await self._create_limit_order(order)
        if not created:
            return None
        return order

    async def cancel_replace(self, order_id: str, new_price: float) -> Optional[Order]:
        """撤单并按新价格重挂。"""
        async with self._lock:
            order = self._orders.get(order_id)
        if not order:
            return None

        if self.settings.dry_run:
            async with self._lock:
                order.status = OrderStatus.CANCELED
                order.updated_at = datetime.now(UTC)
                replacement = Order(
                    order_id=f"o_{uuid.uuid4().hex[:16]}",
                    market_id=order.market_id,
                    bucket_id=order.bucket_id,
                    side=order.side,
                    price=round(new_price, 4),
                    size=order.size - order.filled_size,
                    status=OrderStatus.NEW,
                )
                self._orders[replacement.order_id] = replacement
            await self._simulate_order(replacement)
            return replacement

        canceled = await self._cancel_order_remote(order)
        if not canceled:
            return None

        replacement = Order(
            order_id=f"o_{uuid.uuid4().hex[:16]}",
            market_id=order.market_id,
            bucket_id=order.bucket_id,
            side=order.side,
            price=round(new_price, 4),
            size=order.size - order.filled_size,
            status=OrderStatus.NEW,
        )
        await self._create_limit_order(replacement)
        return replacement

    async def _simulate_order(self, order: Order) -> None:
        """dry-run 本地撮合。"""
        async with self._lock:
            self._orders[order.order_id] = order
            order.status = OrderStatus.ACKED
            order.updated_at = datetime.now(UTC)

        ob = await self.market_data.get_orderbook(order.bucket_id)
        if not ob:
            return

        levels = ob.asks if order.side == Side.BUY else ob.bids
        remaining = order.size
        for lvl in levels:
            if remaining <= 1e-9:
                break
            crosses = (order.side == Side.BUY and lvl.price <= order.price) or (order.side == Side.SELL and lvl.price >= order.price)
            if not crosses:
                break
            take = min(remaining, lvl.size)
            remaining -= take
            fill = Fill(
                order_id=order.order_id,
                market_id=order.market_id,
                bucket_id=order.bucket_id,
                side=order.side,
                price=lvl.price,
                size=take,
            )
            async with self._lock:
                self._fills.append(fill)
                order.filled_size += take
                order.updated_at = datetime.now(UTC)

        async with self._lock:
            if order.filled_size <= 0:
                order.status = OrderStatus.ACKED
            elif order.filled_size < order.size:
                order.status = OrderStatus.PARTIAL
            else:
                order.status = OrderStatus.FILLED

    async def _create_limit_order(self, order: Order) -> bool:
        """调用交易所 REST 创建限价单。"""
        session = await self._get_session()
        payload = {
            "market": order.market_id,
            "asset_id": order.bucket_id,
            "side": order.side.value,
            "price": order.price,
            "size": order.size,
            "type": "limit",
        }
        headers = {
            "POLY_API_KEY": self.settings.polymarket_api_key,
            "POLY_PASSPHRASE": self.settings.polymarket_passphrase,
            "Content-Type": "application/json",
        }
        try:
            async with session.post(f"{self.settings.polymarket_rest_url}/orders", json=payload, headers=headers) as resp:
                if resp.status >= 300:
                    logger.warning("order rejected", extra={"status": resp.status, "payload": payload})
                    return False
                async with self._lock:
                    order.status = OrderStatus.ACKED
                    order.updated_at = datetime.now(UTC)
                    self._orders[order.order_id] = order
                return True
        except Exception:
            logger.exception("failed to create order")
            return False

    async def _cancel_order_remote(self, order: Order) -> bool:
        """调用交易所 REST 撤单。"""
        session = await self._get_session()
        headers = {
            "POLY_API_KEY": self.settings.polymarket_api_key,
            "POLY_PASSPHRASE": self.settings.polymarket_passphrase,
        }
        try:
            async with session.delete(f"{self.settings.polymarket_rest_url}/orders/{order.order_id}", headers=headers) as resp:
                if resp.status >= 300:
                    return False
                async with self._lock:
                    order.status = OrderStatus.CANCELED
                    order.updated_at = datetime.now(UTC)
                return True
        except Exception:
            logger.exception("cancel order failed")
            return False
