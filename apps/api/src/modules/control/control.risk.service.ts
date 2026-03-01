import { BadRequestException, Injectable } from "@nestjs/common";
import type { Environment } from "@weather-trader/shared";
import { ControlStoreService } from "./control.store";

const DAY_MS = 24 * 60 * 60 * 1000;

type RiskCheckInput = {
  env: Environment;
  strategyId?: string | null;
  marketId: string;
  price: number;
  size: number;
  slippageBps?: number;
};

@Injectable()
export class ControlRiskService {
  constructor(private readonly store: ControlStoreService) {}

  checkPreTrade(input: RiskCheckInput): { riskFactor: number } {
    const evaluated = this.evaluatePreTrade(input, true);
    if (!evaluated.pass) {
      throw new BadRequestException(evaluated.reason ?? "risk_rejected");
    }
    return { riskFactor: evaluated.riskFactor };
  }

  previewPreTrade(input: RiskCheckInput): { pass: boolean; reason?: string; riskFactor: number } {
    return this.evaluatePreTrade(input, false);
  }

  private evaluatePreTrade(
    input: RiskCheckInput,
    recordEvent: boolean,
  ): { pass: boolean; reason?: string; riskFactor: number } {
    const env = input.env;
    const notional = input.price * input.size;
    const limitSingleMarket = Number(process.env.RISK_LIMIT_SINGLE_MARKET_NOTIONAL ?? 3000);
    const limitPortfolio = Number(process.env.RISK_LIMIT_PORTFOLIO_NOTIONAL ?? 15000);
    const dailyLossLimit = Number(process.env.RISK_LIMIT_DAILY_LOSS ?? 1200);
    const slippageLimit = Number(process.env.RISK_LIMIT_MAX_SLIPPAGE_BPS ?? 120);
    const sinceDay = Date.now() - DAY_MS;

    const dayOrders = this.store.listOrders({ env, sinceMs: sinceDay, limit: 5000 });
    const marketExposure = dayOrders
      .filter((item) => item.marketId === input.marketId && item.status !== "rejected")
      .reduce((sum, item) => sum + item.amount, 0);
    const portfolioExposure = dayOrders
      .filter((item) => item.status !== "rejected")
      .reduce((sum, item) => sum + item.amount, 0);
    const dayLoss = Math.abs(
      dayOrders.filter((item) => item.pnl < 0).reduce((sum, item) => sum + item.pnl, 0),
    );

    if (marketExposure + notional > limitSingleMarket) {
      if (recordEvent) {
        this.addRisk("limit_hit", "high", env, input.strategyId ?? null, input.marketId, {
          reason: "single_market_limit_hit",
          marketExposure,
          notional,
          limitSingleMarket,
        });
      }
      return { pass: false, reason: "single_market_limit_hit", riskFactor: 0 };
    }

    if (portfolioExposure + notional > limitPortfolio) {
      if (recordEvent) {
        this.addRisk("limit_hit", "critical", env, input.strategyId ?? null, input.marketId, {
          reason: "portfolio_exposure_limit_hit",
          portfolioExposure,
          notional,
          limitPortfolio,
        });
      }
      return { pass: false, reason: "portfolio_exposure_limit_hit", riskFactor: 0 };
    }

    if (dayLoss >= dailyLossLimit) {
      if (recordEvent) {
        this.addRisk("drawdown", "critical", env, input.strategyId ?? null, input.marketId, {
          reason: "daily_loss_limit_hit",
          dayLoss,
          dailyLossLimit,
        });
      }
      return { pass: false, reason: "daily_loss_limit_hit", riskFactor: 0 };
    }

    if ((input.slippageBps ?? 0) > slippageLimit) {
      if (recordEvent) {
        this.addRisk("slippage_spike", "high", env, input.strategyId ?? null, input.marketId, {
          reason: "slippage_limit_hit",
          slippageBps: input.slippageBps,
          slippageLimit,
        });
      }
      return { pass: false, reason: "slippage_limit_hit", riskFactor: 0 };
    }

    const last10 = dayOrders.slice(0, 10);
    const consecutiveLosses = this.countConsecutiveLosses(last10.map((item) => item.pnl));
    if (consecutiveLosses >= 5 && input.strategyId) {
      if (recordEvent) {
        this.store.patchStrategy(input.strategyId, { status: "frozen" });
        this.addRisk("manual_stop", "critical", env, input.strategyId, input.marketId, {
          reason: "consecutive_losses_freeze",
          consecutiveLosses,
        });
      }
      return { pass: false, reason: "strategy_frozen_by_consecutive_losses", riskFactor: 0 };
    }

    return { pass: true, riskFactor: 1 };
  }

  reportApiError(env: Environment, reason: string, strategyId?: string | null, marketId?: string | null): void {
    this.addRisk("api_error", "high", env, strategyId ?? null, marketId ?? null, { reason });
  }

  private countConsecutiveLosses(pnls: number[]): number {
    let count = 0;
    for (const pnl of pnls) {
      if (pnl < 0) {
        count += 1;
      } else {
        break;
      }
    }
    return count;
  }

  private addRisk(
    type: "limit_hit" | "drawdown" | "api_error" | "slippage_spike" | "manual_stop" | "env_switch",
    severity: "low" | "medium" | "high" | "critical",
    env: Environment,
    strategyId: string | null,
    marketId: string | null,
    payload: Record<string, unknown>,
  ) {
    this.store.addRiskEvent({
      env,
      scope: strategyId ? "strategy" : "portfolio",
      strategyId,
      marketId,
      type,
      severity,
      payload,
    });
  }
}
