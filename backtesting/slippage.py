"""
中文说明：本模块属于 Weather Trader 系统，用于提供对应业务功能。
"""

from __future__ import annotations


def simulate_fill_price(side: str, limit_price: float, best_bid: float, best_ask: float, size: float, depth: float) -> tuple[bool, float, float]:
    if depth <= 0:
        return False, 0.0, 0.0

    if side == "buy":
        if limit_price < best_ask:
            return False, 0.0, 0.0
        slippage = min(0.02, size / max(depth, 1.0) * 0.01)
        fill_price = min(0.99, best_ask + slippage)
    else:
        if limit_price > best_bid:
            return False, 0.0, 0.0
        slippage = min(0.02, size / max(depth, 1.0) * 0.01)
        fill_price = max(0.01, best_bid - slippage)

    fill_qty = min(size, depth * 0.25)
    return fill_qty > 0, fill_price, fill_qty