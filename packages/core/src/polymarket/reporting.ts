import { roundTo } from "./math";
import type { ExecutionSnapshot, ForecastEvaluationPoint } from "./types";

type EquityPoint = {
  ts: number;
  equity: number;
};

type CalibrationBin = {
  binStart: number;
  binEnd: number;
  count: number;
  avgPredicted: number;
  observedFrequency: number;
};

export type ResearchReport = {
  generatedAt: string;
  summary: {
    mode: "PAPER" | "REAL";
    totalOrders: number;
    totalFills: number;
    totalSettlements: number;
  };
  tradingMetrics: {
    totalReturn: number;
    maxDrawdownPct: number;
    sharpe: number;
    sortino: number;
    winRatePct: number;
    profitFactor: number;
    expectancy: number;
    turnover: number;
    avgHoldingMinutes: number;
    feeRatioPct: number;
  };
  forecastMetrics: {
    brierScore: number;
    logLoss: number;
    sharpness: number;
    calibration: CalibrationBin[];
    horizonBreakdown: Array<{ bucket: "T-7+" | "T-3~7" | "T-1~3" | "T-0~1"; brier: number; count: number }>;
  };
  robustness: {
    feeStress: Array<{ feeMultiplier: number; projectedReturn: number }>;
    slippageStress: Array<{ extraSlippageBps: number; projectedReturn: number }>;
    reconciliation: {
      ledgerSettledPnl: number;
      settlementsSum: number;
      diff: number;
    };
  };
  decomposition: {
    byMarket: Array<{ key: string; pnl: number; trades: number }>;
    byCity: Array<{ key: string; pnl: number; trades: number }>;
    byDate: Array<{ key: string; pnl: number; trades: number }>;
  };
  charts: {
    equityCurve: EquityPoint[];
    drawdownCurve: Array<{ ts: number; drawdownPct: number }>;
    calibration: CalibrationBin[];
  };
};

function calcSharpe(returns: number[]): number {
  if (returns.length < 2) {
    return 0;
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => {
      const delta = value - mean;
      return sum + delta * delta;
    }, 0) /
    (returns.length - 1);
  const std = Math.sqrt(Math.max(variance, 0));
  if (std === 0) {
    return 0;
  }
  return roundTo((mean / std) * Math.sqrt(365), 6);
}

function calcSortino(returns: number[]): number {
  if (returns.length < 2) {
    return 0;
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const downside = returns.filter((value) => value < 0);
  if (downside.length < 2) {
    return 0;
  }
  const downsideMean = downside.reduce((sum, value) => sum + value, 0) / downside.length;
  const downsideVariance =
    downside.reduce((sum, value) => {
      const delta = value - downsideMean;
      return sum + delta * delta;
    }, 0) /
    (downside.length - 1);
  const downsideDev = Math.sqrt(Math.max(downsideVariance, 0));
  if (downsideDev === 0) {
    return 0;
  }
  return roundTo((mean / downsideDev) * Math.sqrt(365), 6);
}

function calcDrawdown(curve: EquityPoint[]): {
  maxDrawdownPct: number;
  curve: Array<{ ts: number; drawdownPct: number }>;
} {
  if (curve.length === 0) {
    return { maxDrawdownPct: 0, curve: [] };
  }

  let peak = curve[0].equity;
  let max = 0;
  const points: Array<{ ts: number; drawdownPct: number }> = [];
  for (const point of curve) {
    peak = Math.max(peak, point.equity);
    const dd = peak <= 0 ? 0 : ((peak - point.equity) / peak) * 100;
    if (dd > max) {
      max = dd;
    }
    points.push({ ts: point.ts, drawdownPct: roundTo(dd, 4) });
  }
  return { maxDrawdownPct: roundTo(max, 4), curve: points };
}

function calcCalibration(rows: ForecastEvaluationPoint[]): CalibrationBin[] {
  const bins = Array.from({ length: 10 }, (_, index) => ({
    binStart: index / 10,
    binEnd: (index + 1) / 10,
    values: [] as ForecastEvaluationPoint[],
  }));
  for (const row of rows) {
    const index = Math.min(9, Math.max(0, Math.floor(row.probability * 10)));
    bins[index].values.push(row);
  }
  return bins.map((bin) => {
    const count = bin.values.length;
    if (count === 0) {
      return {
        binStart: bin.binStart,
        binEnd: bin.binEnd,
        count: 0,
        avgPredicted: 0,
        observedFrequency: 0,
      };
    }
    const avgPredicted = bin.values.reduce((sum, row) => sum + row.probability, 0) / count;
    const observed = bin.values.reduce((sum, row) => sum + row.observed, 0) / count;
    return {
      binStart: bin.binStart,
      binEnd: bin.binEnd,
      count,
      avgPredicted: roundTo(avgPredicted, 4),
      observedFrequency: roundTo(observed, 4),
    };
  });
}

function mapHorizonBucket(row: ForecastEvaluationPoint): "T-7+" | "T-3~7" | "T-1~3" | "T-0~1" {
  const days = (row.resolveTs - row.forecastTs) / (24 * 3600 * 1000);
  if (days >= 7) return "T-7+";
  if (days >= 3) return "T-3~7";
  if (days >= 1) return "T-1~3";
  return "T-0~1";
}

export function buildResearchReport(input: {
  snapshot: ExecutionSnapshot;
  initialCash: number;
  equityCurve: EquityPoint[];
  forecastRows: ForecastEvaluationPoint[];
}): ResearchReport {
  const { snapshot, forecastRows } = input;
  const realizedFromSettlements = snapshot.settlements.reduce((sum, item) => sum + item.settledPnlDelta, 0);
  const returns = input.equityCurve
    .slice(1)
    .map((point, index) => {
      const prev = input.equityCurve[index]?.equity ?? point.equity;
      if (prev <= 0) {
        return 0;
      }
      return (point.equity - prev) / prev;
    });
  const wins = snapshot.settlements.filter((item) => item.settledPnlDelta > 0);
  const losses = snapshot.settlements.filter((item) => item.settledPnlDelta < 0);
  const grossProfit = wins.reduce((sum, item) => sum + item.settledPnlDelta, 0);
  const grossLoss = Math.abs(losses.reduce((sum, item) => sum + item.settledPnlDelta, 0));
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? Number.POSITIVE_INFINITY : 0) : grossProfit / grossLoss;
  const expectancy = snapshot.settlements.length === 0 ? 0 : realizedFromSettlements / snapshot.settlements.length;

  const turnover = snapshot.fills.reduce((sum, fill) => sum + fill.notional, 0);
  const totalFees = snapshot.fills.reduce((sum, fill) => sum + fill.fee, 0);
  const feeRatio = turnover <= 0 ? 0 : (totalFees / turnover) * 100;

  const holdingMinutes = snapshot.orders
    .filter((order) => order.status === "FILLED" || order.status === "PARTIALLY_FILLED")
    .map((order) => Math.max(0, (order.updatedAtMs - order.createdAtMs) / 60000));
  const avgHolding = holdingMinutes.length === 0 ? 0 : holdingMinutes.reduce((sum, m) => sum + m, 0) / holdingMinutes.length;

  const totalReturn = input.initialCash <= 0 ? 0 : ((snapshot.ledger.cash - input.initialCash) / input.initialCash) * 100;
  const drawdown = calcDrawdown(input.equityCurve);

  const brier =
    forecastRows.length === 0
      ? 0
      : forecastRows.reduce((sum, row) => sum + (row.probability - row.observed) ** 2, 0) / forecastRows.length;
  const logLoss =
    forecastRows.length === 0
      ? 0
      : -forecastRows.reduce((sum, row) => {
          const p = Math.min(1 - 1e-6, Math.max(1e-6, row.probability));
          return sum + (row.observed === 1 ? Math.log(p) : Math.log(1 - p));
        }, 0) / forecastRows.length;
  const meanProb =
    forecastRows.length === 0 ? 0 : forecastRows.reduce((sum, row) => sum + row.probability, 0) / forecastRows.length;
  const sharpness =
    forecastRows.length === 0
      ? 0
      : forecastRows.reduce((sum, row) => sum + Math.abs(row.probability - meanProb), 0) / forecastRows.length;

  const byHorizonMap = new Map<"T-7+" | "T-3~7" | "T-1~3" | "T-0~1", ForecastEvaluationPoint[]>();
  for (const row of forecastRows) {
    const bucket = mapHorizonBucket(row);
    const rows = byHorizonMap.get(bucket) ?? [];
    rows.push(row);
    byHorizonMap.set(bucket, rows);
  }
  const horizonBuckets: Array<"T-7+" | "T-3~7" | "T-1~3" | "T-0~1"> = ["T-7+", "T-3~7", "T-1~3", "T-0~1"];
  const horizonBreakdown: ResearchReport["forecastMetrics"]["horizonBreakdown"] = horizonBuckets.map((bucket) => {
    const rows = byHorizonMap.get(bucket) ?? [];
    const score = rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + (row.probability - row.observed) ** 2, 0) / rows.length;
    return {
      bucket,
      brier: roundTo(score, 6),
      count: rows.length,
    };
  });

  const byMarket = new Map<string, { pnl: number; trades: number }>();
  for (const settlement of snapshot.settlements) {
    const row = byMarket.get(settlement.marketId) ?? { pnl: 0, trades: 0 };
    row.pnl += settlement.settledPnlDelta;
    row.trades += 1;
    byMarket.set(settlement.marketId, row);
  }
  const byCity = new Map<string, { pnl: number; trades: number }>();
  const byDate = new Map<string, { pnl: number; trades: number }>();
  for (const [market, row] of byMarket.entries()) {
    const city = market.split("_")[0] ?? "UNKNOWN";
    const date = market.split("_")[1] ?? "UNKNOWN";
    const cityRow = byCity.get(city) ?? { pnl: 0, trades: 0 };
    cityRow.pnl += row.pnl;
    cityRow.trades += row.trades;
    byCity.set(city, cityRow);

    const dateRow = byDate.get(date) ?? { pnl: 0, trades: 0 };
    dateRow.pnl += row.pnl;
    dateRow.trades += row.trades;
    byDate.set(date, dateRow);
  }

  const settleSum = snapshot.settlements.reduce((sum, row) => sum + row.settledPnlDelta, 0);
  const diff = settleSum - snapshot.ledger.settledPnl;

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      mode: snapshot.mode,
      totalOrders: snapshot.orders.length,
      totalFills: snapshot.fills.length,
      totalSettlements: snapshot.settlements.length,
    },
    tradingMetrics: {
      totalReturn: roundTo(totalReturn, 6),
      maxDrawdownPct: drawdown.maxDrawdownPct,
      sharpe: calcSharpe(returns),
      sortino: calcSortino(returns),
      winRatePct:
        snapshot.settlements.length === 0
          ? 0
          : roundTo((wins.length / snapshot.settlements.length) * 100, 4),
      profitFactor: Number.isFinite(profitFactor) ? roundTo(profitFactor, 6) : Number.POSITIVE_INFINITY,
      expectancy: roundTo(expectancy, 6),
      turnover: roundTo(turnover, 6),
      avgHoldingMinutes: roundTo(avgHolding, 4),
      feeRatioPct: roundTo(feeRatio, 6),
    },
    forecastMetrics: {
      brierScore: roundTo(brier, 6),
      logLoss: roundTo(logLoss, 6),
      sharpness: roundTo(sharpness, 6),
      calibration: calcCalibration(forecastRows),
      horizonBreakdown,
    },
    robustness: {
      feeStress: [1, 1.5, 2].map((multiplier) => ({
        feeMultiplier: multiplier,
        projectedReturn: roundTo(
          totalReturn - (totalFees * (multiplier - 1) * 100) / Math.max(input.initialCash, 1),
          6,
        ),
      })),
      slippageStress: [0, 5, 10, 20].map((extra) => ({
        extraSlippageBps: extra,
        projectedReturn: roundTo(
          totalReturn - ((turnover * extra) / 10000 / Math.max(input.initialCash, 1)) * 100,
          6,
        ),
      })),
      reconciliation: {
        ledgerSettledPnl: roundTo(snapshot.ledger.settledPnl, 6),
        settlementsSum: roundTo(settleSum, 6),
        diff: roundTo(diff, 6),
      },
    },
    decomposition: {
      byMarket: [...byMarket.entries()].map(([key, value]) => ({
        key,
        pnl: roundTo(value.pnl, 6),
        trades: value.trades,
      })),
      byCity: [...byCity.entries()].map(([key, value]) => ({
        key,
        pnl: roundTo(value.pnl, 6),
        trades: value.trades,
      })),
      byDate: [...byDate.entries()].map(([key, value]) => ({
        key,
        pnl: roundTo(value.pnl, 6),
        trades: value.trades,
      })),
    },
    charts: {
      equityCurve: input.equityCurve,
      drawdownCurve: drawdown.curve,
      calibration: calcCalibration(forecastRows),
    },
  };
}
