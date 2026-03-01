import { clamp01, roundTo } from "./math";
import { PaperExecutionEngine, type PaperEngineConfig } from "./paper-engine";
import { buildResearchReport, type ResearchReport } from "./reporting";
import type {
  ForecastEvaluationPoint,
  ForecastPoint,
  MarketQuote,
  MarketSettlement,
  WeatherMarket,
} from "./types";

export type EdgeStrategyConfig = {
  edgeThreshold: number;
  minConfidence: number;
  orderNotional: number;
  maxOrdersPerTick: number;
};

export type PaperRunnerInput = {
  markets: WeatherMarket[];
  quotes: MarketQuote[];
  forecasts: ForecastPoint[];
  settlements: MarketSettlement[];
  execution: Omit<PaperEngineConfig, "riskLimits"> & {
    riskLimits: PaperEngineConfig["riskLimits"];
  };
  strategy: EdgeStrategyConfig;
};

export type PaperRunnerOutput = {
  report: ResearchReport;
  forecastEval: ForecastEvaluationPoint[];
  snapshot: ReturnType<PaperExecutionEngine["getSnapshot"]>;
  auditJsonl: string;
};

function toOutcomeResult(settlements: MarketSettlement[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const settlement of settlements) {
    map.set(settlement.marketId, settlement.winningOutcomeId);
  }
  return map;
}

export async function runPaperResearch(input: PaperRunnerInput): Promise<PaperRunnerOutput> {
  const engine = new PaperExecutionEngine(input.execution);
  const marketCloseById = new Map(input.markets.map((market) => [market.id, market.closeTimeMs]));
  const sortedQuotes = [...input.quotes].sort((a, b) => a.ts - b.ts);
  const sortedForecasts = [...input.forecasts].sort((a, b) => a.forecastTs - b.forecastTs);
  const sortedSettlements = [...input.settlements].sort((a, b) => a.ts - b.ts);
  const processedForecasts = new Set<number>();
  const equityCurve: Array<{ ts: number; equity: number }> = [
    { ts: sortedQuotes[0]?.ts ?? Date.now(), equity: input.execution.initialCash },
  ];

  for (const quote of sortedQuotes) {
    const signals: Array<{ marketId: string; outcomeId: string; edge: number; probability: number }> = [];
    for (let idx = 0; idx < sortedForecasts.length; idx += 1) {
      if (processedForecasts.has(idx)) {
        continue;
      }
      const row = sortedForecasts[idx];
      if (row.forecastTs > quote.ts || row.marketId !== quote.marketId) {
        continue;
      }
      const outcomeQuote = quote.outcomes[row.outcomeId];
      if (!outcomeQuote) {
        processedForecasts.add(idx);
        continue;
      }
      const implied = clamp01(outcomeQuote.midpoint);
      const edge = row.probability - implied;
      if (Math.abs(edge) >= input.strategy.edgeThreshold && row.probability >= input.strategy.minConfidence) {
        signals.push({
          marketId: row.marketId,
          outcomeId: row.outcomeId,
          edge,
          probability: row.probability,
        });
      }
      processedForecasts.add(idx);
    }

    const shortlisted = signals
      .sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))
      .slice(0, input.strategy.maxOrdersPerTick);
    for (const signal of shortlisted) {
      const outcomeQuote = quote.outcomes[signal.outcomeId];
      const side = signal.edge > 0 ? "BUY" : "SELL";
      const price = side === "BUY" ? outcomeQuote.bestAsk : outcomeQuote.bestBid;
      const quantity = roundTo(input.strategy.orderNotional / Math.max(price, 0.0001), 4);
      if (quantity <= 0) {
        continue;
      }
      try {
        await engine.submit(
          {
            marketId: signal.marketId,
            outcomeId: signal.outcomeId,
            side,
            type: "LIMIT",
            quantity,
            limitPrice: price,
            tif: "IOC",
            createdAtMs: quote.ts,
            strategyId: "edge-baseline",
            tags: {
              marketCloseTs: String(marketCloseById.get(signal.marketId) ?? Number.MAX_SAFE_INTEGER),
            },
          },
          quote,
        );
      } catch {
        // intentionally keep runner resilient for batch research
      }
    }

    await engine.onTime(quote.ts);
    await engine.onMarketDataTick(quote);
    const ledger = engine.getSnapshot().ledger;
    equityCurve.push({
      ts: quote.ts,
      equity: roundTo(ledger.cash + ledger.reservedCash, 4),
    });
  }

  for (const settlement of sortedSettlements) {
    await engine.settle(settlement);
    const ledger = engine.getSnapshot().ledger;
    equityCurve.push({
      ts: settlement.ts,
      equity: roundTo(ledger.cash + ledger.reservedCash, 4),
    });
  }

  const outcomeMap = toOutcomeResult(sortedSettlements);
  const forecastEval: ForecastEvaluationPoint[] = sortedForecasts
    .filter((row) => outcomeMap.has(row.marketId))
    .map((row) => {
      const quote = sortedQuotes.find(
        (item) => item.marketId === row.marketId && item.ts >= row.forecastTs && item.outcomes[row.outcomeId],
      );
      const implied = quote?.outcomes[row.outcomeId]?.midpoint ?? 0.5;
      return {
        ...row,
        observed: outcomeMap.get(row.marketId) === row.outcomeId ? 1 : 0,
        marketImpliedProbability: roundTo(implied, 6),
      };
    });

  const snapshot = engine.getSnapshot();
  return {
    snapshot,
    forecastEval,
    auditJsonl: engine.getAuditJsonl(),
    report: buildResearchReport({
      snapshot,
      initialCash: input.execution.initialCash,
      equityCurve: equityCurve.sort((a, b) => a.ts - b.ts),
      forecastRows: forecastEval,
    }),
  };
}
