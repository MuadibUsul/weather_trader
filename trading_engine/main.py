"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import signal
from pathlib import Path
from typing import Any, Dict, List

from .config import get_engine_settings
from .logging_utils import configure_logging
from .models import BucketRange
from .orchestrator import MarketDefinition, StrategyOrchestrator


def load_market_defs(path: str) -> List[MarketDefinition]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    markets: List[MarketDefinition] = []
    for item in data:
        buckets = [BucketRange(bucket_id=b["bucket_id"], lower=float(b["lower"]), upper=float(b["upper"])) for b in item["buckets"]]
        markets.append(MarketDefinition(market_id=item["market_id"], resolution_url=item["resolution_url"], buckets=buckets))
    return markets


async def run(args: argparse.Namespace) -> None:
    settings = get_engine_settings()
    configure_logging(settings.log_level)

    orchestrator = StrategyOrchestrator(settings)
    market_path = args.markets or os.getenv("MARKETS_CONFIG", "database/sample_markets.json")
    for market in load_market_defs(market_path):
        await orchestrator.register_market(market)

    await orchestrator.update_config(order_size=args.order_size, quote_delta=args.quote_delta, dry_run=args.dry_run)

    stop_event = asyncio.Event()

    def _stop(*_: Any) -> None:
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _stop)
        except NotImplementedError:
            pass

    await orchestrator.start()
    await stop_event.wait()
    await orchestrator.close()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Weather trading engine")
    p.add_argument("--markets", default="", help="Path to market definition json")
    p.add_argument("--order-size", type=float, default=25.0)
    p.add_argument("--quote-delta", type=float, default=0.01)
    p.add_argument("--dry-run", action="store_true", default=False)
    return p


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()