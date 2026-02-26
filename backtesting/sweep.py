"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

from itertools import product
from typing import Dict, Iterable, List

import pandas as pd

from .engine import BacktestConfig, BacktestEngine


class ParameterSweep:
    def __init__(self, weather: pd.DataFrame, market: pd.DataFrame) -> None:
        self.weather = weather
        self.market = market

    def run(self, grid: Dict[str, Iterable[float]]) -> List[dict]:
        keys = list(grid.keys())
        values = [list(grid[k]) for k in keys]
        results: List[dict] = []

        for combo in product(*values):
            params = dict(zip(keys, combo))
            config = BacktestConfig(
                edge_threshold=float(params.get("edge_threshold", 0.03)),
                tx_buffer=float(params.get("tx_buffer", 0.01)),
                quote_delta=float(params.get("quote_delta", 0.01)),
                order_size=float(params.get("order_size", 25.0)),
                sigma0=float(params.get("sigma0", 3.5)),
                decay_k=float(params.get("decay_k", 0.09)),
            )
            engine = BacktestEngine(config)
            result = engine.run(self.weather, self.market)
            results.append({"params": params, "summary": result["summary"]})

        results.sort(key=lambda x: x["summary"]["total_pnl"], reverse=True)
        return results