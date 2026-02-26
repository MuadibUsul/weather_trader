"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from trading_engine.config import get_engine_settings
from trading_engine.models import BucketRange
from trading_engine.orchestrator import MarketDefinition, StrategyOrchestrator


class EngineService:
    def __init__(self) -> None:
        self.orchestrator = StrategyOrchestrator(get_engine_settings())
        self._initialized = False
        self._init_lock = asyncio.Lock()

    async def initialize(self) -> None:
        async with self._init_lock:
            if self._initialized:
                return
            markets_path = Path("database/sample_markets.json")
            if markets_path.exists():
                data = json.loads(markets_path.read_text(encoding="utf-8"))
                for item in data:
                    await self.orchestrator.register_market(
                        MarketDefinition(
                            market_id=item["market_id"],
                            resolution_url=item["resolution_url"],
                            buckets=[BucketRange(**bucket) for bucket in item["buckets"]],
                        )
                    )
            self._initialized = True

    async def start_strategy(self) -> Dict[str, Any]:
        await self.initialize()
        await self.orchestrator.start()
        return await self.orchestrator.status()

    async def stop_strategy(self) -> Dict[str, Any]:
        await self.orchestrator.stop()
        return await self.orchestrator.status()

    async def configure(self, order_size: float, quote_delta: float, dry_run: bool) -> Dict[str, Any]:
        await self.orchestrator.update_config(order_size=order_size, quote_delta=quote_delta, dry_run=dry_run)
        return await self.orchestrator.status()

    async def status(self) -> Dict[str, Any]:
        await self.initialize()
        return await self.orchestrator.status()

    async def shutdown(self) -> None:
        await self.orchestrator.close()


engine_service = EngineService()