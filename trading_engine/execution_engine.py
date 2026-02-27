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
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Dict, List, Optional

import aiohttp

from .config import EngineSettings
from .market_data_engine import MarketDataEngine
from .models import Fill, Order, OrderIntent, OrderStatus, Side

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class PolymarketLiveConfig:
    private_key: str
    funder: str
    api_key: str
    api_secret: str
    api_passphrase: str
    signature_type: int = 0


class ExecutionEngine:
    """订单生命周期管理器。"""

    def __init__(self, settings: EngineSettings, market_data: MarketDataEngine) -> None:
        self.settings = settings
        self.market_data = market_data
        self._session: Optional[aiohttp.ClientSession] = None
        self._orders: Dict[str, Order] = {}
        self._fills: List[Fill] = []
        self._live_config: Optional[PolymarketLiveConfig] = None
        self._clob_client = None
        self._paper_wallet_id: Optional[str] = None
        self._paper_balance: Optional[float] = None
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

    async def configure_live_trading(self, config: Optional[PolymarketLiveConfig]) -> None:
        """注入或清空实盘签名凭据。"""
        async with self._lock:
            self._live_config = config
            self._clob_client = None

    async def live_trading_ready(self) -> bool:
        """是否具备实盘下单所需签名材料。"""
        async with self._lock:
            return self._live_config is not None

    async def configure_paper_account(self, wallet_id: Optional[str], balance_usdc: Optional[float]) -> None:
        """注入纸面账户（资金按真钱约束）。"""
        async with self._lock:
            self._paper_wallet_id = wallet_id
            self._paper_balance = float(balance_usdc) if balance_usdc is not None else None

    async def paper_account_state(self) -> Dict[str, Optional[float | str]]:
        async with self._lock:
            return {
                "wallet_id": self._paper_wallet_id,
                "balance_usdc": self._paper_balance,
            }

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
            if not await self._paper_funds_available(intent):
                logger.info(
                    "paper funds insufficient; skip intent",
                    extra={
                        "bucket": intent.bucket_id,
                        "required": intent.price * intent.size,
                    },
                )
                return None
            await self._simulate_order(order)
            return order

        if not await self.live_trading_ready():
            logger.warning("live trading credentials missing; skip intent", extra={"bucket": intent.bucket_id})
            return None

        created = await self._create_limit_order(order)
        if not created:
            return None
        return order

    async def submit_manual_intent(self, intent: OrderIntent, max_slippage: float = 0.02, force_live: bool = True) -> Dict[str, object]:
        """手动下单入口：返回更可观测的错误信息。"""
        slippage = await self.market_data.estimate_slippage(intent.bucket_id, intent.side, intent.size)
        if slippage > max_slippage:
            return {
                "ok": False,
                "error": "slippage_exceeded",
                "details": {"slippage": slippage, "max_slippage": max_slippage},
            }

        order = Order(
            order_id=f"o_{uuid.uuid4().hex[:16]}",
            market_id=intent.market_id,
            bucket_id=intent.bucket_id,
            side=intent.side,
            price=round(intent.price, 4),
            size=round(intent.size, 4),
            status=OrderStatus.NEW,
        )

        if not force_live:
            if not await self._paper_funds_available(intent):
                return {"ok": False, "error": "paper_funds_insufficient"}
            await self._simulate_order(order)
            return {"ok": True, "order_id": order.order_id, "status": order.status.value}

        if not await self.live_trading_ready():
            return {"ok": False, "error": "live_trading_not_ready"}

        try:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, self._post_signed_order_sync, order)
            remote_order_id = str(result.get("orderID") or result.get("id") or result.get("orderId") or order.order_id)
            async with self._lock:
                order.order_id = remote_order_id
                order.status = OrderStatus.ACKED
                order.updated_at = datetime.now(UTC)
                self._orders[order.order_id] = order
            return {"ok": True, "order_id": order.order_id, "status": order.status.value}
        except Exception as exc:
            logger.exception("manual signed order failed")
            return {"ok": False, "error": str(exc)}

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
                if self._paper_balance is not None:
                    notional = fill.price * take
                    if fill.side == Side.BUY:
                        self._paper_balance = max(0.0, self._paper_balance - notional)
                    else:
                        self._paper_balance += notional
                order.updated_at = datetime.now(UTC)

        async with self._lock:
            if order.filled_size <= 0:
                order.status = OrderStatus.ACKED
            elif order.filled_size < order.size:
                order.status = OrderStatus.PARTIAL
            else:
                order.status = OrderStatus.FILLED

    async def _create_limit_order(self, order: Order) -> bool:
        """使用 Polymarket 官方 CLOB 客户端签名并提交限价单。"""
        try:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(None, self._post_signed_order_sync, order)
            remote_order_id = str(result.get("orderID") or result.get("id") or result.get("orderId") or order.order_id)
            async with self._lock:
                order.order_id = remote_order_id
                order.status = OrderStatus.ACKED
                order.updated_at = datetime.now(UTC)
                self._orders[order.order_id] = order
            return True
        except Exception:
            logger.exception("failed to create signed polymarket order")
            return False

    async def _cancel_order_remote(self, order: Order) -> bool:
        """使用 Polymarket 官方 CLOB 客户端撤单。"""
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._cancel_signed_order_sync, order.order_id)
            async with self._lock:
                order.status = OrderStatus.CANCELED
                order.updated_at = datetime.now(UTC)
            return True
        except Exception:
            logger.exception("cancel order failed")
            return False

    def _build_or_get_clob_client_sync(self):
        # 延迟导入，避免 dry-run 场景强依赖 py-clob-client。
        from py_clob_client.client import ClobClient
        from py_clob_client.clob_types import ApiCreds

        if self._clob_client is not None:
            return self._clob_client
        if self._live_config is None:
            raise RuntimeError("missing live config")

        cfg = self._live_config
        chain_id = 137
        client = ClobClient(
            self.settings.polymarket_rest_url,
            chain_id=chain_id,
            key=cfg.private_key,
            signature_type=cfg.signature_type,
            funder=cfg.funder,
        )
        client.set_api_creds(
            ApiCreds(
                api_key=cfg.api_key,
                api_secret=cfg.api_secret,
                api_passphrase=cfg.api_passphrase,
            )
        )
        self._clob_client = client
        return client

    def _post_signed_order_sync(self, order: Order) -> Dict[str, object]:
        from py_clob_client.clob_types import OrderArgs, OrderType
        from py_clob_client.order_builder.constants import BUY, SELL

        side = BUY if order.side == Side.BUY else SELL
        client = self._build_or_get_clob_client_sync()
        signed = client.create_order(
            OrderArgs(
                token_id=order.bucket_id,
                price=float(order.price),
                size=float(order.size),
                side=side,
            )
        )
        result = client.post_order(signed, OrderType.GTC)
        if not isinstance(result, dict):
            raise RuntimeError(f"unexpected order response: {result}")
        return result

    def _cancel_signed_order_sync(self, order_id: str) -> None:
        client = self._build_or_get_clob_client_sync()
        client.cancel(order_id)

    async def _paper_funds_available(self, intent: OrderIntent) -> bool:
        if intent.side != Side.BUY:
            return True
        async with self._lock:
            if self._paper_balance is None:
                return True
            required = intent.price * intent.size
            return self._paper_balance + 1e-9 >= required

    async def test_live_connectivity(self) -> Dict[str, object]:
        """简单连通性测试：公有健康 + 私有 API key 访问。"""
        if not await self.live_trading_ready():
            return {"ok": False, "message": "live_trading_not_ready"}
        loop = asyncio.get_running_loop()
        try:
            payload = await loop.run_in_executor(None, self._test_live_connectivity_sync)
            return {"ok": True, "message": "ok", "payload": payload}
        except Exception as exc:
            return {"ok": False, "message": str(exc)}

    def _test_live_connectivity_sync(self) -> Dict[str, object]:
        client = self._build_or_get_clob_client_sync()
        ok_payload = client.get_ok()
        # 访问私有接口以确认 API Key 可用。
        api_keys_payload = client.get_api_keys()
        return {"ok": ok_payload, "api_keys": api_keys_payload}
