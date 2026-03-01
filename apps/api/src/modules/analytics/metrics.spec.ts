import { describe, expect, it } from "vitest";
import {
  calcEquity,
  calcMaxDrawdown,
  calcProfitFactor,
  calcSharpe,
  calcWinRate,
  filterByWindow,
  type TimePoint,
} from "./metrics";

describe("metrics formula", () => {
  it("equity formula matches spec", () => {
    expect(calcEquity(1000, 120, -20, 15)).toBe(1085);
  });

  it("max drawdown handles monotonic up curve", () => {
    const points: TimePoint[] = [
      { ts: "2026-01-01T00:00:00.000Z", equity: 100 },
      { ts: "2026-01-02T00:00:00.000Z", equity: 110 },
      { ts: "2026-01-03T00:00:00.000Z", equity: 120 },
    ];
    expect(calcMaxDrawdown(points)).toBe(0);
  });

  it("max drawdown computes peak-to-trough percentage", () => {
    const points: TimePoint[] = [
      { ts: "2026-01-01T00:00:00.000Z", equity: 100 },
      { ts: "2026-01-02T00:00:00.000Z", equity: 80 },
      { ts: "2026-01-03T00:00:00.000Z", equity: 120 },
      { ts: "2026-01-04T00:00:00.000Z", equity: 90 },
    ];
    expect(calcMaxDrawdown(points)).toBe(25);
  });

  it("win rate uses closed trades count", () => {
    expect(
      calcWinRate([
        { pnl: 10, closedAt: "2026-01-01T00:00:00.000Z" },
        { pnl: -5, closedAt: "2026-01-02T00:00:00.000Z" },
        { pnl: 1, closedAt: "2026-01-03T00:00:00.000Z" },
      ]),
    ).toBeCloseTo(66.6667, 3);
  });

  it("profit factor calculates gross profit / gross loss", () => {
    expect(
      calcProfitFactor([
        { pnl: 30, closedAt: "2026-01-01T00:00:00.000Z" },
        { pnl: -10, closedAt: "2026-01-02T00:00:00.000Z" },
        { pnl: 20, closedAt: "2026-01-03T00:00:00.000Z" },
      ]),
    ).toBe(5);
  });

  it("profit factor returns Infinity when no losses", () => {
    expect(
      calcProfitFactor([
        { pnl: 10, closedAt: "2026-01-01T00:00:00.000Z" },
        { pnl: 5, closedAt: "2026-01-02T00:00:00.000Z" },
      ]),
    ).toBe(Number.POSITIVE_INFINITY);
  });

  it("sharpe handles zero volatility", () => {
    const points: TimePoint[] = [
      { ts: "2026-01-01T00:00:00.000Z", equity: 100 },
      { ts: "2026-01-02T00:00:00.000Z", equity: 100 },
      { ts: "2026-01-03T00:00:00.000Z", equity: 100 },
    ];
    expect(calcSharpe(points)).toBe(0);
  });

  it("sharpe positive when upward with variance", () => {
    const points: TimePoint[] = [
      { ts: "2026-01-01T00:00:00.000Z", equity: 100 },
      { ts: "2026-01-02T00:00:00.000Z", equity: 105 },
      { ts: "2026-01-03T00:00:00.000Z", equity: 103 },
      { ts: "2026-01-04T00:00:00.000Z", equity: 110 },
    ];
    expect(calcSharpe(points)).toBeGreaterThan(0);
  });

  it("window filter isolates only recent data", () => {
    const now = Date.parse("2026-02-28T00:00:00.000Z");
    const rows = [
      { ts: "2026-02-20T00:00:00.000Z", equity: 100 },
      { ts: "2026-02-27T00:00:00.000Z", equity: 101 },
    ];
    expect(filterByWindow(rows, "7D", now)).toHaveLength(1);
  });

  it("window ALL keeps full series", () => {
    const rows = [
      { ts: "2026-01-01T00:00:00.000Z", equity: 100 },
      { ts: "2026-02-01T00:00:00.000Z", equity: 110 },
    ];
    expect(filterByWindow(rows, "ALL", Date.now())).toHaveLength(2);
  });
});
