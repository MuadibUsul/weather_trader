import { Injectable, OnModuleDestroy } from "@nestjs/common";
import type { Environment } from "@weather-trader/shared";
import { calcMaxDrawdown, calcSharpe, type TimePoint } from "../analytics/metrics";
import { ControlStoreService } from "./control.store";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ControlAllocatorService implements OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs = Math.max(60_000, Number(process.env.ALLOCATOR_INTERVAL_MS ?? 5 * 60_000));

  constructor(private readonly store: ControlStoreService) {
    if (process.env.NODE_ENV !== "test") {
      this.timer = setInterval(() => {
        void this.rebalance("REAL");
      }, this.intervalMs);
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getAllocationPct(strategyId: string, env: Environment): number {
    const row = this.store.latestAllocation(strategyId, env);
    if (row) {
      return row.allocationPct;
    }
    return env === "REAL" ? 10 : 100;
  }

  getExecutionFactor(strategyId: string, env: Environment): number {
    const pct = this.getAllocationPct(strategyId, env);
    return Number((Math.max(0, pct) / 100).toFixed(6));
  }

  async rebalance(env: Environment): Promise<void> {
    if (env !== "REAL") {
      return;
    }
    const strategies = this.store.listStrategies();
    const since7d = Date.now() - DAY_MS * 7;
    const exposure = this.store.latestExposure("REAL");

    for (const strategy of strategies) {
      if (strategy.status !== "real_small" && strategy.status !== "real_scaled" && strategy.status !== "real_approved") {
        continue;
      }
      const pnlPoints = this.store
        .listPnlSnapshots({ env: "REAL", strategyId: strategy.id, sinceMs: since7d })
        .map<TimePoint>((item) => ({ ts: item.timestamp, equity: item.equity }));
      const sharpe = calcSharpe(pnlPoints);
      const dd = calcMaxDrawdown(pnlPoints);
      const recentRisks = this.store.listRiskEvents({ env: "REAL", strategyId: strategy.id, sinceMs: Date.now() - DAY_MS });
      const highRisk = recentRisks.some((item) => item.severity === "high" || item.severity === "critical");
      const current = this.getAllocationPct(strategy.id, "REAL");
      let next = current;
      const reasons: Record<string, unknown> = {
        source: "dynamic_allocator",
        prevAllocationPct: current,
        sharpe7d: sharpe,
        drawdown7d: dd,
      };

      if (highRisk || dd > 15) {
        next = Math.max(2, current - 5);
        reasons.rule = "risk_downscale";
      } else if (sharpe > 1.2 && dd < 10) {
        next = Math.min(25, current + 2);
        reasons.rule = "performance_upscale";
      }

      const concentratedCity = exposure
        ? Object.entries(exposure.byCity).find(([, value]) => value >= 40)?.[0]
        : undefined;
      if (concentratedCity) {
        next = Math.max(2, next - 3);
        reasons.exposureRule = {
          city: concentratedCity,
          concentrationPct: exposure?.byCity[concentratedCity],
        };
      }

      next = Number(next.toFixed(4));
      if (next !== current) {
        this.store.addAllocation({
          strategyId: strategy.id,
          env: "REAL",
          allocationPct: next,
          reason: reasons,
        });
        if (next <= 5) {
          this.store.patchStrategy(strategy.id, { status: "real_small" });
        } else if (next >= 12) {
          this.store.patchStrategy(strategy.id, { status: "real_scaled" });
        }
      }
    }
  }
}
