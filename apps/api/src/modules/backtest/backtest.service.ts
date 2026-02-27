import { Injectable } from "@nestjs/common";
import {
  BacktestEngine,
  DataFeed,
  ExecutionSimulator,
  RiskEngine,
  Strategy,
  Candle,
} from "@weather-trader/core";
import { EventsGateway } from "../../gateway/events.gateway";
import { BacktestRequestDto } from "./dto/backtest-request.dto";

@Injectable()
export class BacktestService {
  constructor(private readonly events: EventsGateway) {}

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
}
