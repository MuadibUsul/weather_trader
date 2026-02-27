import { DataFeed } from "../feed/DataFeed";
import { ExecutionSimulator, ExecutedTrade, PortfolioState } from "../execution/ExecutionSimulator";
import { Metrics, EquityPoint, BacktestMetrics } from "../metrics/Metrics";
import { RiskEngine } from "../risk/RiskEngine";
import { Candle, Strategy, StrategyContext, TradeSignal } from "../strategy/Strategy";

export type RejectedSignal = {
  signal: TradeSignal;
  reason: string;
};

export type BacktestResult = {
  trades: ExecutedTrade[];
  rejectedSignals: RejectedSignal[];
  equityCurve: EquityPoint[];
  metrics: BacktestMetrics;
  finalCash: number;
  finalPositions: Record<string, number>;
};

export type BacktestConfig = {
  initialCash: number;
  feed: DataFeed;
  strategy: Strategy;
  simulator: ExecutionSimulator;
  risk: RiskEngine;
};

function markToMarket(portfolio: PortfolioState, prices: Map<string, number>) {
  let value = portfolio.cash;
  for (const [symbol, qty] of portfolio.positions) {
    value += qty * (prices.get(symbol) ?? 0);
  }
  return value;
}

export class BacktestEngine {
  private readonly history = new Map<string, Candle[]>();
  private readonly lastPrice = new Map<string, number>();

  constructor(private readonly config: BacktestConfig) {}

  run(): BacktestResult {
    const portfolio: PortfolioState = {
      cash: this.config.initialCash,
      positions: new Map(),
    };

    const trades: ExecutedTrade[] = [];
    const rejectedSignals: RejectedSignal[] = [];
    const equityCurve: EquityPoint[] = [{ ts: 0, equity: this.config.initialCash }];

    let index = 0;
    for (let candle = this.config.feed.next(); candle; candle = this.config.feed.next()) {
      this.lastPrice.set(candle.symbol, candle.close);
      const symbolHistory = this.history.get(candle.symbol) ?? [];
      symbolHistory.push(candle);
      this.history.set(candle.symbol, symbolHistory);

      const equityNow = markToMarket(portfolio, this.lastPrice);
      this.config.risk.syncEquity(equityNow);

      const positions = new Map(
        Array.from(portfolio.positions.entries()).map(([symbol, quantity]) => [
          symbol,
          { quantity, markPrice: this.lastPrice.get(symbol) ?? 0 },
        ]),
      );

      const ctx: StrategyContext = {
        index,
        candle,
        equity: equityNow,
        historyBySymbol: this.history,
        positions,
      };

      const signals = this.config.strategy.onCandle(candle, ctx) ?? [];
      for (const signal of signals) {
        if (signal.quantity <= 0) {
          rejectedSignals.push({ signal, reason: "invalid_quantity" });
          continue;
        }

        const markPrice = this.lastPrice.get(signal.symbol);
        if (!markPrice) {
          rejectedSignals.push({ signal, reason: "missing_price" });
          continue;
        }

        const risk = this.config.risk.evaluate(signal, {
          equity: markToMarket(portfolio, this.lastPrice),
          positionQty: portfolio.positions.get(signal.symbol) ?? 0,
          markPrice,
        });

        if (!risk.ok) {
          rejectedSignals.push({ signal, reason: risk.reason ?? "risk_rejected" });
          continue;
        }

        const trade = this.config.simulator.execute(signal, markPrice, portfolio);
        trades.push(trade);
        this.config.risk.syncEquity(markToMarket(portfolio, this.lastPrice));
      }

      equityCurve.push({ ts: candle.ts, equity: markToMarket(portfolio, this.lastPrice) });
      index += 1;
    }

    return {
      trades,
      rejectedSignals,
      equityCurve,
      metrics: Metrics.from(equityCurve, trades),
      finalCash: portfolio.cash,
      finalPositions: Object.fromEntries(portfolio.positions.entries()),
    };
  }
}
