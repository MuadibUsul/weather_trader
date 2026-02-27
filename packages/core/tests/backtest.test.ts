import { describe, expect, it } from "vitest";
import { BacktestEngine } from "../src/engine/BacktestEngine";
import { ExecutionSimulator } from "../src/execution/ExecutionSimulator";
import { DataFeed } from "../src/feed/DataFeed";
import { RiskEngine } from "../src/risk/RiskEngine";
import { Candle, Strategy } from "../src/strategy/Strategy";

function runBacktest(candles: Candle[], strategy: Strategy, feeRate = 0, slippageBps = 0, maxDrawdownPct = 90) {
  const engine = new BacktestEngine({
    initialCash: 10_000,
    feed: new DataFeed(candles),
    strategy,
    simulator: new ExecutionSimulator({ feeRate, slippageBps }),
    risk: new RiskEngine(
      {
        maxDrawdownPct,
        maxNotionalPerTrade: 100_000,
        maxPositionPerSymbol: 10_000,
      },
      10_000,
    ),
  });

  return engine.run();
}

describe("BacktestEngine", () => {
  it("is deterministic for identical input", () => {
    const candles: Candle[] = [
      { ts: 1, symbol: "A", open: 1, high: 1.1, low: 0.9, close: 1 },
      { ts: 2, symbol: "A", open: 1, high: 1.2, low: 1, close: 1.1 },
      { ts: 3, symbol: "A", open: 1.1, high: 1.3, low: 1, close: 1.2 },
    ];

    const strategy: Strategy = {
      name: "buy_once",
      onCandle(candle) {
        if (candle.ts === 1) {
          return [{ ts: candle.ts, symbol: candle.symbol, side: "buy", quantity: 100 }];
        }
        return [];
      },
    };

    const run1 = runBacktest(candles, strategy, 0.001, 5);
    const run2 = runBacktest(candles, strategy, 0.001, 5);

    expect(run1).toEqual(run2);
  });

  it("applies fee and slippage", () => {
    const candles: Candle[] = [
      { ts: 1, symbol: "A", open: 1, high: 1.1, low: 0.9, close: 1 },
      { ts: 2, symbol: "A", open: 1, high: 1.2, low: 1, close: 1.1 },
    ];

    const strategy: Strategy = {
      name: "buy_hold",
      onCandle(candle) {
        return candle.ts === 1 ? [{ ts: 1, symbol: "A", side: "buy", quantity: 1000 }] : [];
      },
    };

    const noCost = runBacktest(candles, strategy, 0, 0);
    const withCost = runBacktest(candles, strategy, 0.001, 10);

    expect(withCost.metrics.finalEquity).toBeLessThan(noCost.metrics.finalEquity);
    expect(withCost.metrics.totalFees).toBeGreaterThan(0);
  });

  it("enforces max drawdown", () => {
    const candles: Candle[] = [
      { ts: 1, symbol: "A", open: 1, high: 1.1, low: 0.9, close: 1 },
      { ts: 2, symbol: "A", open: 1, high: 1, low: 0.4, close: 0.5 },
      { ts: 3, symbol: "A", open: 0.5, high: 0.6, low: 0.4, close: 0.5 },
      { ts: 4, symbol: "A", open: 0.5, high: 0.6, low: 0.4, close: 0.5 },
    ];

    const strategy: Strategy = {
      name: "always_buy",
      onCandle(candle) {
        return [{ ts: candle.ts, symbol: "A", side: "buy", quantity: 2000 }];
      },
    };

    const result = runBacktest(candles, strategy, 0, 0, 5);
    expect(result.rejectedSignals.length).toBeGreaterThan(0);
    expect(result.rejectedSignals.some((r) => r.reason.includes("max_drawdown_exceeded"))).toBe(true);
  });

  it("supports multi-asset processing", () => {
    const candles: Candle[] = [
      { ts: 1, symbol: "A", open: 1, high: 1.1, low: 0.9, close: 1 },
      { ts: 1, symbol: "B", open: 2, high: 2.1, low: 1.9, close: 2 },
      { ts: 2, symbol: "A", open: 1, high: 1.2, low: 0.95, close: 1.1 },
      { ts: 2, symbol: "B", open: 2, high: 2.2, low: 1.8, close: 2.1 },
    ];

    const strategy: Strategy = {
      name: "pair_buy",
      onCandle(candle) {
        if (candle.ts === 1) {
          return [{ ts: candle.ts, symbol: candle.symbol, side: "buy", quantity: 100 }];
        }
        return [];
      },
    };

    const result = runBacktest(candles, strategy);
    expect(result.finalPositions.A).toBe(100);
    expect(result.finalPositions.B).toBe(100);
    expect(result.trades).toHaveLength(2);
  });
});
