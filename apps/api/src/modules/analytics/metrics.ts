export type TimePoint = {
  ts: string;
  equity: number;
};

export type ClosedTrade = {
  pnl: number;
  closedAt: string;
};

export type MetricsWindow = "ALL" | "1D" | "7D" | "30D";

export type MetricsSummary = {
  equity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  maxDrawdownAll: number;
  maxDrawdown7d: number;
  maxDrawdown30d: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function calcEquity(initial: number, realizedPnl: number, unrealizedPnl: number, fees: number): number {
  return initial + realizedPnl + unrealizedPnl - fees;
}

export function filterByWindow<T extends { ts: string }>(points: T[], window: MetricsWindow, now = Date.now()): T[] {
  if (window === "ALL") {
    return points;
  }
  const offset = window === "1D" ? DAY_MS : window === "7D" ? DAY_MS * 7 : DAY_MS * 30;
  const since = now - offset;
  return points.filter((item) => new Date(item.ts).getTime() >= since);
}

export function calcMaxDrawdown(points: TimePoint[]): number {
  if (points.length === 0) {
    return 0;
  }
  let peak = points[0].equity;
  let maxDd = 0;
  for (const item of points) {
    if (item.equity > peak) {
      peak = item.equity;
    }
    if (peak <= 0) {
      continue;
    }
    const dd = (peak - item.equity) / peak;
    if (dd > maxDd) {
      maxDd = dd;
    }
  }
  return Number((maxDd * 100).toFixed(4));
}

export function calcWinRate(trades: ClosedTrade[]): number {
  if (trades.length === 0) {
    return 0;
  }
  const wins = trades.filter((item) => item.pnl > 0).length;
  return Number(((wins / trades.length) * 100).toFixed(4));
}

export function calcProfitFactor(trades: ClosedTrade[]): number {
  let grossProfit = 0;
  let grossLoss = 0;
  for (const trade of trades) {
    if (trade.pnl >= 0) {
      grossProfit += trade.pnl;
    } else {
      grossLoss += Math.abs(trade.pnl);
    }
  }
  if (grossLoss === 0) {
    return grossProfit > 0 ? Number.POSITIVE_INFINITY : 0;
  }
  return Number((grossProfit / grossLoss).toFixed(6));
}

export function calcSharpe(points: TimePoint[], annualRiskFree = 0): number {
  if (points.length < 2) {
    return 0;
  }

  const sorted = [...points].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const returns: number[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1].equity;
    const curr = sorted[i].equity;
    if (prev <= 0) {
      continue;
    }
    returns.push((curr - prev) / prev);
  }

  if (returns.length < 2) {
    return 0;
  }

  const rfDaily = annualRiskFree / 365;
  const adjusted = returns.map((r) => r - rfDaily);
  const mean = adjusted.reduce((sum, val) => sum + val, 0) / adjusted.length;
  const variance =
    adjusted.reduce((sum, val) => {
      const d = val - mean;
      return sum + d * d;
    }, 0) /
    (adjusted.length - 1);
  const std = Math.sqrt(Math.max(variance, 0));

  if (std === 0) {
    return 0;
  }

  const sharpe = (mean / std) * Math.sqrt(365);
  return Number(sharpe.toFixed(6));
}
