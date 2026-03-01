import { Injectable } from "@nestjs/common";
import {
  BacktestEngine,
  DataFeed,
  ExecutionSimulator,
  RiskEngine,
  runPaperResearch,
  Strategy,
  Candle,
} from "@weather-trader/core";
import { EventsGateway } from "../../gateway/events.gateway";
import { BacktestRequestDto } from "./dto/backtest-request.dto";
import { WeatherPaperRequestDto } from "./dto/weather-paper-request.dto";
import { PolymarketOfficialDataService } from "./polymarket-official-data.service";

@Injectable()
export class BacktestService {
  constructor(
    private readonly events: EventsGateway,
    private readonly officialData: PolymarketOfficialDataService,
  ) {}

  run(input: BacktestRequestDto) {
    const candles = input.candles as Candle[];

    const strategy: Strategy = {
      name: "threshold_strategy",
      onCandle(candle) {
        if (candle.close <= input.strategy.buyBelow) {
          return [
            {
              ts: candle.ts,
              symbol: candle.symbol,
              side: "buy",
              quantity: input.strategy.quantity,
              tag: "buy_below",
            },
          ];
        }
        if (candle.close >= input.strategy.sellAbove) {
          return [
            {
              ts: candle.ts,
              symbol: candle.symbol,
              side: "sell",
              quantity: input.strategy.quantity,
              tag: "sell_above",
            },
          ];
        }
        return [];
      },
    };

    const engine = new BacktestEngine({
      initialCash: input.initialCash,
      feed: new DataFeed(candles),
      strategy,
      simulator: new ExecutionSimulator({ feeRate: input.feeRate, slippageBps: input.slippageBps }),
      risk: new RiskEngine(
        {
          maxDrawdownPct: input.risk.maxDrawdownPct,
          maxPositionPerSymbol: input.risk.maxPositionPerSymbol,
          maxNotionalPerTrade: input.risk.maxNotionalPerTrade,
        },
        input.initialCash,
      ),
    });

    const result = engine.run();

    this.events.emitSystemLog({ level: "info", message: "Backtest completed", metrics: result.metrics });
    if (result.rejectedSignals.length) {
      this.events.emitRiskAlert({ type: "backtest_reject", count: result.rejectedSignals.length });
    }
    if (result.trades.length) {
      this.events.emitOrderUpdate({ type: "backtest_trade", lastTrade: result.trades[result.trades.length - 1] });
    }

    return result;
  }

  async runWeatherPaper(input: WeatherPaperRequestDto) {
    const scenario = await this.officialData.loadResolvedWeatherScenario({
      marketLimit: input.marketLimit,
      fidelitySec: input.fidelitySec,
      syntheticSpread: input.syntheticSpread,
      syntheticDepth: input.syntheticDepth,
    });
    const baseExecution = {
      initialCash: input.initialCash,
      feeRate: input.feeRate,
      slippageBps: input.slippageBps,
      latencyMs: 500,
      maxFillRatioPerTick: 0.2,
      spreadSlippageK: 0.25,
      impactBps: 10,
      riskLimits: {
        maxNotionalPerOrder: 50_000,
        maxPositionPerOutcome: 25_000,
        maxExposurePerMarket: 80_000,
        maxOpenOrders: 100,
        maxDailyLoss: 20_000,
      },
    } as const;
    const strategyConfig = {
      edgeThreshold: input.edgeThreshold,
      minConfidence: input.minConfidence,
      orderNotional: input.orderNotional,
      maxOrdersPerTick: 2,
    } as const;

    const runVariant = async (modelVariant: "deterministic_l2" | "stochastic_impact") => {
      const matchingModel =
        modelVariant === "deterministic_l2"
          ? (input.matchingModel === "mid" ? "mid" : "deterministic_l2")
          : "stochastic_impact";
      const output = await runPaperResearch({
        ...scenario,
        execution: {
          ...baseExecution,
          matchingModel,
          stochasticSeed: input.seed,
        },
        strategy: strategyConfig,
      });
      const checks = this.computeEligibility(output.report);
      return {
        modelVariant,
        output,
        realEligibility: {
          eligibleForReal: Object.values(checks).every(Boolean),
          checks,
        },
      };
    };

    const variants =
      input.paperModel === "both"
        ? await Promise.all([runVariant("deterministic_l2"), runVariant("stochastic_impact")])
        : [await runVariant(input.paperModel)];
    const primaryVariant = variants.find((item) => item.modelVariant === "deterministic_l2") ?? variants[0];

    this.events.emitSystemLog({
      level: "info",
      message: "Weather paper research completed",
      payload: {
        primaryModel: primaryVariant.modelVariant,
        totalOrders: primaryVariant.output.report.summary.totalOrders,
        totalSettlements: primaryVariant.output.report.summary.totalSettlements,
        totalReturn: primaryVariant.output.report.tradingMetrics.totalReturn,
        brier: primaryVariant.output.report.forecastMetrics.brierScore,
        scenario: "official_resolved",
        sourceMeta: scenario.sourceMeta,
      },
    });

    const byVariant = Object.fromEntries(
      variants.map((item) => [
        item.modelVariant,
        {
          report: item.output.report,
          forecastEval: item.output.forecastEval,
          snapshot: item.output.snapshot,
          auditJsonl: item.output.auditJsonl,
          realEligibility: item.realEligibility,
        },
      ]),
    );
    const comparison =
      variants.length === 2
        ? {
            totalReturnDelta: Number(
              (
                (byVariant.stochastic_impact?.report.tradingMetrics.totalReturn ?? 0) -
                (byVariant.deterministic_l2?.report.tradingMetrics.totalReturn ?? 0)
              ).toFixed(6),
            ),
            brierDelta: Number(
              (
                (byVariant.stochastic_impact?.report.forecastMetrics.brierScore ?? 0) -
                (byVariant.deterministic_l2?.report.forecastMetrics.brierScore ?? 0)
              ).toFixed(6),
            ),
          }
        : null;

    return {
      ...primaryVariant.output,
      modelVariant: primaryVariant.modelVariant,
      sourceMeta: scenario.sourceMeta,
      executionConfig: {
        latencyMs: 500,
        maxFillRatioPerTick: 0.2,
        spreadSlippageK: 0.25,
        impactBps: 10,
        tradingFeeRate: input.feeRate,
        seed: input.seed,
      },
      realEligibility: primaryVariant.realEligibility,
      variants: byVariant,
      sensitivityDelta: comparison,
    };
  }

  private computeEligibility(report: Awaited<ReturnType<typeof runPaperResearch>>["report"]) {
    return {
      positiveReturn: report.tradingMetrics.totalReturn > 0,
      drawdownOk: report.tradingMetrics.maxDrawdownPct <= 15,
      brierOk: report.forecastMetrics.brierScore <= 0.25,
      minTrades: report.summary.totalFills >= 3,
    };
  }
}
