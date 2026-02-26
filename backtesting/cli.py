"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .data_loader import HistoricalDataLoader
from .engine import BacktestConfig, BacktestEngine
from .sweep import ParameterSweep


def parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Weather market backtesting")
    p.add_argument("--weather", required=True, help="CSV path for weather history")
    p.add_argument("--market", required=True, help="CSV path for market history")
    p.add_argument("--sweep", action="store_true", help="run parameter sweep")
    p.add_argument("--grid", default="", help="JSON file containing parameter grid")
    p.add_argument("--out", default="backtest_result.json", help="output JSON path")
    p.add_argument("--edge-threshold", type=float, default=0.03)
    p.add_argument("--tx-buffer", type=float, default=0.01)
    p.add_argument("--quote-delta", type=float, default=0.01)
    p.add_argument("--order-size", type=float, default=25.0)
    p.add_argument("--sigma0", type=float, default=3.5)
    p.add_argument("--decay-k", type=float, default=0.09)
    return p


def main() -> None:
    args = parser().parse_args()

    weather, market = HistoricalDataLoader(args.weather, args.market).load()

    if args.sweep:
        if not args.grid:
            raise ValueError("--grid is required with --sweep")
        grid = json.loads(Path(args.grid).read_text(encoding="utf-8"))
        result = ParameterSweep(weather, market).run(grid)
    else:
        config = BacktestConfig(
            edge_threshold=args.edge_threshold,
            tx_buffer=args.tx_buffer,
            quote_delta=args.quote_delta,
            order_size=args.order_size,
            sigma0=args.sigma0,
            decay_k=args.decay_k,
        )
        result = BacktestEngine(config).run(weather, market)

    Path(args.out).write_text(json.dumps(result, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()