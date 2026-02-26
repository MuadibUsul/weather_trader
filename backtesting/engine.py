"""
回测主引擎。

职责：
1. 对齐天气与盘口历史数据。
2. 复现实盘核心逻辑（模型概率、edge 触发、限价成交）。
3. 输出 PnL 路径与绩效指标。
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List

import numpy as np
import pandas as pd

from .metrics import PerfMetrics, compute_metrics
from .slippage import simulate_fill_price


@dataclass
class BacktestConfig:
    """回测参数集合。"""
    edge_threshold: float = 0.03
    tx_buffer: float = 0.01
    quote_delta: float = 0.01
    order_size: float = 25.0
    sigma0: float = 3.5
    decay_k: float = 0.09


class BacktestEngine:
    """回测执行器。"""

    def __init__(self, config: BacktestConfig) -> None:
        self.config = config

    def run(self, weather: pd.DataFrame, market: pd.DataFrame) -> dict:
        """执行回测并返回 summary + 路径结果。"""
        required_weather = {"ts", "market_id", "t_max_sofar", "forecast_daily_max", "hours_remaining"}
        required_market = {
            "ts",
            "market_id",
            "bucket_id",
            "bucket_lower",
            "bucket_upper",
            "market_prob",
            "best_bid",
            "best_ask",
            "depth",
        }
        missing_w = required_weather - set(weather.columns)
        missing_m = required_market - set(market.columns)
        if missing_w:
            raise ValueError(f"weather columns missing: {sorted(missing_w)}")
        if missing_m:
            raise ValueError(f"market columns missing: {sorted(missing_m)}")

        merged = market.merge(weather, on=["ts", "market_id"], how="left", suffixes=("", "_w"))
        merged = merged.dropna(subset=["t_max_sofar", "forecast_daily_max", "hours_remaining"])
        merged = merged.sort_values(["ts", "market_id", "bucket_id"])

        positions: Dict[str, Dict[str, float]] = {}
        pnl_path: List[float] = []
        edge_path: List[float] = []
        cash = 0.0

        for _, row in merged.iterrows():
            # 动态波动衰减：越接近结算，sigma 越小。
            sigma = max(0.35, self.config.sigma0 * math.exp(-self.config.decay_k * (24 - min(24.0, float(row["hours_remaining"])))))
            mu = max(float(row["t_max_sofar"]), float(row["forecast_daily_max"]))
            p_model = self._bucket_probability(mu, sigma, float(row["bucket_lower"]), float(row["bucket_upper"]))
            edge = p_model - float(row["market_prob"])
            edge_path.append(edge)

            trigger = self.config.edge_threshold + self.config.tx_buffer
            if abs(edge) < trigger:
                # 无 edge 时仅盯市，不执行交易。
                cash = self._mark_to_market(cash, positions, row)
                pnl_path.append(cash)
                continue

            side = "buy" if edge > 0 else "sell"
            target = p_model - self.config.quote_delta if side == "buy" else p_model + self.config.quote_delta
            ok, fill_price, fill_qty = simulate_fill_price(
                side=side,
                limit_price=max(0.01, min(0.99, target)),
                best_bid=float(row["best_bid"]),
                best_ask=float(row["best_ask"]),
                size=self.config.order_size,
                depth=float(row["depth"]),
            )
            if ok:
                key = f"{row['market_id']}:{row['bucket_id']}"
                state = positions.setdefault(key, {"qty": 0.0, "avg": 0.0, "last": float(row["market_prob"])})
                qty = fill_qty if side == "buy" else -fill_qty
                state["qty"] += qty
                state["avg"] = fill_price if abs(state["qty"]) > 1e-9 else 0.0
                cash += -fill_price * fill_qty if side == "buy" else fill_price * fill_qty

            # 每个时刻均执行盯市，确保权益曲线连续。
            cash = self._mark_to_market(cash, positions, row)
            pnl_path.append(cash)

        perf: PerfMetrics = compute_metrics(pnl_path, edge_path)
        return {
            "summary": {
                "sharpe": perf.sharpe,
                "max_drawdown": perf.max_drawdown,
                "win_rate": perf.win_rate,
                "edge_decay": perf.edge_decay,
                "total_pnl": perf.total_pnl,
            },
            "pnl_path": pnl_path,
            "edge_path": edge_path,
        }

    def _mark_to_market(self, cash: float, positions: Dict[str, Dict[str, float]], row: pd.Series) -> float:
        """按 mid 价格进行持仓盯市估值。"""
        mark = 0.0
        key = f"{row['market_id']}:{row['bucket_id']}"
        state = positions.get(key)
        if state:
            mid = (float(row["best_bid"]) + float(row["best_ask"])) / 2.0
            state["last"] = mid
        for state in positions.values():
            mark += state["qty"] * state["last"]
        return cash + mark

    def _bucket_probability(self, mu: float, sigma: float, lower: float, upper: float) -> float:
        """桶概率计算：CDF(upper)-CDF(lower)。"""
        cdf_u = 0.5 * (1.0 + math.erf((upper - mu) / (sigma * math.sqrt(2))))
        cdf_l = 0.5 * (1.0 + math.erf((lower - mu) / (sigma * math.sqrt(2))))
        return max(0.0, cdf_u - cdf_l)
