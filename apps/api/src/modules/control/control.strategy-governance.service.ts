import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  ApproveRealDto,
  Environment,
  RejectRealDto,
  RequestRealDto,
  StrategyApprovalDto,
  StrategyLifecycleStatus,
  StrategyProfileDto,
} from "@weather-trader/shared";
import { calcMaxDrawdown, calcProfitFactor, calcWinRate, type ClosedTrade, type TimePoint } from "../analytics/metrics";
import { ControlStoreService } from "./control.store";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ControlStrategyGovernanceService {
  constructor(private readonly store: ControlStoreService) {}

  listStrategies(): StrategyProfileDto[] {
    return this.store.listStrategies();
  }

  listApprovals(strategyId: string): StrategyApprovalDto[] {
    return this.store.listApprovals(strategyId);
  }

  getStrategy(strategyId: string): StrategyProfileDto {
    const strategy = this.store.getStrategy(strategyId);
    if (!strategy) {
      throw new BadRequestException("strategy_not_found");
    }
    return strategy;
  }

  evaluateEligibility(strategyId: string): { eligible: boolean; reason: string[] } {
    const now = Date.now();
    const orders = this.store.listOrders({ env: "PAPER", strategyId, sinceMs: now - DAY_MS * 30, limit: 20000 });
    const pnlPoints = this.store
      .listPnlSnapshots({ env: "PAPER", strategyId, sinceMs: now - DAY_MS * 30 })
      .map<TimePoint>((item) => ({ ts: item.timestamp, equity: item.equity }));
    const trades: ClosedTrade[] = orders.map((item) => ({ pnl: item.pnl, closedAt: item.createdAt }));

    const reasons: string[] = [];
    if (orders.length <= 100) reasons.push("paper_trade_count<=100");
    if (calcWinRate(trades) <= 55) reasons.push("paper_win_rate<=55%");
    if (calcProfitFactor(trades) <= 1.5) reasons.push("paper_profit_factor<=1.5");
    if (calcMaxDrawdown(pnlPoints) >= 15) reasons.push("paper_max_drawdown>=15%");

    return {
      eligible: reasons.length === 0,
      reason: reasons,
    };
  }

  requestReal(strategyId: string, payload: RequestRealDto, requestedBy = "system"): StrategyProfileDto {
    const strategy = this.getStrategy(strategyId);
    if (strategy.status === "real_requested") {
      return strategy;
    }

    const eligibility = this.evaluateEligibility(strategyId);
    if (!eligibility.eligible && strategy.status !== "eligible") {
      throw new BadRequestException("strategy_not_eligible");
    }

    this.store.patchStrategy(strategyId, { status: "real_requested" });
    this.store.addApproval({
      strategyId,
      requestedBy,
      approvedBy: null,
      status: "requested",
      payload: {
        reason: payload.reason,
        eligibility,
      },
    });
    return this.getStrategy(strategyId);
  }

  approveReal(strategyId: string, payload: ApproveRealDto, approvedBy = "admin"): StrategyProfileDto {
    this.getStrategy(strategyId);
    this.store.addApproval({
      strategyId,
      requestedBy: "system",
      approvedBy,
      status: "approved",
      payload: {
        riskLimits: payload.riskLimits,
        initialAllocationPct: payload.initialAllocationPct,
      },
    });
    this.store.patchStrategy(strategyId, { status: "real_approved" });
    this.store.addAllocation({
      strategyId,
      env: "REAL",
      allocationPct: Math.max(0, Math.min(25, payload.initialAllocationPct || 10)),
      reason: {
        source: "approval",
      },
    });
    this.store.patchStrategy(strategyId, { status: "real_small" });
    return this.getStrategy(strategyId);
  }

  rejectReal(strategyId: string, payload: RejectRealDto, approvedBy = "admin"): StrategyProfileDto {
    this.getStrategy(strategyId);
    this.store.addApproval({
      strategyId,
      requestedBy: "system",
      approvedBy,
      status: "rejected",
      payload: {
        reason: payload.reason,
      },
    });
    this.store.patchStrategy(strategyId, { status: "paper_testing" });
    return this.getStrategy(strategyId);
  }

  assertRealAutoTradingAllowed(strategyId: string): void {
    const strategy = this.getStrategy(strategyId);
    const allowed: StrategyLifecycleStatus[] = ["real_approved", "real_small", "real_scaled"];
    if (!allowed.includes(strategy.status)) {
      throw new BadRequestException("strategy_real_not_approved");
    }
  }

  hasRealApprovedStrategy(): boolean {
    return this.store
      .listStrategies()
      .some((item) => item.status === "real_approved" || item.status === "real_small" || item.status === "real_scaled");
  }

  computeEnvStatus(
    env: Environment,
    deps: { walletConnected: boolean; credentialHealthy: boolean; realGatewayReady?: boolean },
  ): { realReady: boolean; reasons: string[] } {
    if (env !== "REAL") {
      return { realReady: true, reasons: [] };
    }
    const reasons: string[] = [];
    if (!deps.walletConnected) reasons.push("real_wallet_not_connected");
    if (!deps.credentialHealthy) reasons.push("real_credential_unhealthy");
    if (deps.realGatewayReady === false) reasons.push("real_gateway_not_configured");
    if (!this.hasRealApprovedStrategy()) reasons.push("no_real_approved_strategy");
    return {
      realReady: reasons.length === 0,
      reasons,
    };
  }
}
