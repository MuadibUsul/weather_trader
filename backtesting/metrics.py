"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable

import numpy as np


@dataclass
class PerfMetrics:
    sharpe: float
    max_drawdown: float
    win_rate: float
    edge_decay: float
    total_pnl: float


def compute_metrics(pnl_series: Iterable[float], edge_series: Iterable[float]) -> PerfMetrics:
    pnl = np.array(list(pnl_series), dtype=float)
    edges = np.array(list(edge_series), dtype=float)

    if len(pnl) == 0:
        return PerfMetrics(0.0, 0.0, 0.0, 0.0, 0.0)

    rets = np.diff(np.concatenate(([0.0], pnl)))
    ret_std = float(np.std(rets))
    sharpe = 0.0 if ret_std <= 1e-12 else float(np.mean(rets) / ret_std * math.sqrt(252))

    running_max = np.maximum.accumulate(pnl)
    dd = np.where(running_max > 0, (running_max - pnl) / running_max, 0.0)
    max_drawdown = float(np.max(dd)) if len(dd) else 0.0

    wins = np.sum(rets > 0)
    losses = np.sum(rets < 0)
    win_rate = float(wins / (wins + losses)) if (wins + losses) else 0.0

    if len(edges) >= 2:
        x = np.arange(len(edges))
        slope = np.polyfit(x, edges, 1)[0]
        edge_decay = float(-slope)
    else:
        edge_decay = 0.0

    return PerfMetrics(
        sharpe=sharpe,
        max_drawdown=max_drawdown,
        win_rate=win_rate,
        edge_decay=edge_decay,
        total_pnl=float(pnl[-1]),
    )