import { ExecutedTrade } from "../execution/ExecutionSimulator";

export type EquityPoint = {
  ts: number;
  equity: number;
};

export type BacktestMetrics = {
  initialEquity: number;
  finalEquity: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  tradeCount: number;
  turnover: number;
  totalFees: number;
  sharpeLike: number;
};

export class Metrics {
  static from(equityCurve: EquityPoint[], trades: ExecutedTrade[]): BacktestMetrics {
    const initialEquity = equityCurve[0]?.equity ?? 0;
    const finalEquity = equityCurve[equityCurve.length - 1]?.equity ?? initialEquity;
    const totalReturnPct = initialEquity === 0 ? 0 : ((finalEquity - initialEquity) / initialEquity) * 100;

    let peak = initialEquity;
    let maxDrawdownPct = 0;
    for (const point of equityCurve) {
      peak = Math.max(peak, point.equity);
      if (peak > 0) {
        const dd = ((peak - point.equity) / peak) * 100;
        maxDrawdownPct = Math.max(maxDrawdownPct, dd);
      }
    }

    const returns: number[] = [];
    for (let i = 1; i < equityCurve.length; i += 1) {
      const prev = equityCurve[i - 1].equity;
      const curr = equityCurve[i].equity;
      returns.push(prev === 0 ? 0 : (curr - prev) / prev);
    }

    const mean = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance =
      returns.length > 1
        ? returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1)
        : 0;
    const std = Math.sqrt(variance);
    const sharpeLike = std === 0 ? 0 : (mean / std) * Math.sqrt(returns.length || 1);

    const turnover = trades.reduce((acc, t) => acc + t.notional, 0);
    const totalFees = trades.reduce((acc, t) => acc + t.fee, 0);

    return {
      initialEquity,
      finalEquity,
      totalReturnPct,
      maxDrawdownPct,
      tradeCount: trades.length,
      turnover,
      totalFees,
      sharpeLike,
    };
  }
}
