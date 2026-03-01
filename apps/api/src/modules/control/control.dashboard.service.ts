import { Injectable } from "@nestjs/common";
import type {
  DashboardSummaryDto,
  Environment,
  EquityPointDto,
  ExposureDto,
  HealthPanelDto,
  StrategyLeaderboardRowDto,
  TopSignalDto,
} from "@weather-trader/shared";
import { calcMaxDrawdown, calcProfitFactor, calcSharpe, calcWinRate, type ClosedTrade, type TimePoint } from "../analytics/metrics";
import { ControlStoreService } from "./control.store";
import { MarketsService } from "../markets/markets.service";

const DAY_MS = 24 * 60 * 60 * 1000;

type Range = "1D" | "7D" | "30D" | "ALL";

function rangeSinceMs(range: Range): number {
  const now = Date.now();
  if (range === "1D") return now - DAY_MS;
  if (range === "7D") return now - DAY_MS * 7;
  if (range === "30D") return now - DAY_MS * 30;
  return 0;
}

@Injectable()
export class ControlDashboardService {
  constructor(
    private readonly store: ControlStoreService,
    private readonly markets: MarketsService,
  ) {}

  getSummary(env: Environment, range: Range): DashboardSummaryDto {
    const sinceMs = rangeSinceMs(range);
    const pnl = this.store.listPnlSnapshots({ env, strategyId: null, sinceMs });
    const orders = this.store.listOrders({ env, sinceMs, limit: 5000 });
    const trades: ClosedTrade[] = orders.map((item) => ({ pnl: item.pnl, closedAt: item.createdAt }));
    const points: TimePoint[] = pnl.map((item) => ({ ts: item.timestamp, equity: item.equity }));
    const latest = pnl[pnl.length - 1];
    const defaultInitial = env === "REAL" ? Number(process.env.REAL_INITIAL_CAPITAL ?? 5000) : Number(process.env.PAPER_INITIAL_CAPITAL ?? 100000);
    const latestAllocation = this.store
      .listAllocations({ env, sinceMs })
      .reduce((sum, item) => sum + item.allocationPct, 0);
    const latestEquity = latest?.equity ?? defaultInitial;
    const deployedCapital = Number(Math.max(0, (latestEquity * latestAllocation) / 100).toFixed(4));
    const availableCash = Number(Math.max(0, latestEquity - deployedCapital).toFixed(4));

    const now = Date.now();
    const pnl1d = orders
      .filter((item) => new Date(item.createdAt).getTime() >= now - DAY_MS)
      .reduce((sum, item) => sum + item.pnl, 0);
    const pnl7d = orders
      .filter((item) => new Date(item.createdAt).getTime() >= now - DAY_MS * 7)
      .reduce((sum, item) => sum + item.pnl, 0);
    const pnl30d = orders
      .filter((item) => new Date(item.createdAt).getTime() >= now - DAY_MS * 30)
      .reduce((sum, item) => sum + item.pnl, 0);

    const riskEvents = this.store.listRiskEvents({ env, sinceMs: now - DAY_MS, limit: 200 });
    const hasCritical = riskEvents.some((item) => item.severity === "critical");
    const hasHigh = riskEvents.some((item) => item.severity === "high");
    const riskStatus = hasCritical ? "danger" : hasHigh ? "watch" : "safe";

    const leaderboard = this.getStrategyLeaderboard(env, "7D");
    const bestStrategyId = leaderboard[0]?.strategyId;

    return {
      env,
      range,
      totalEquity: Number(latestEquity.toFixed(4)),
      availableCash,
      deployedCapital,
      pnl1d: Number(pnl1d.toFixed(4)),
      pnl7d: Number(pnl7d.toFixed(4)),
      pnl30d: Number(pnl30d.toFixed(4)),
      maxDrawdown: calcMaxDrawdown(points),
      sharpe: calcSharpe(points),
      winRate: calcWinRate(trades),
      profitFactor: calcProfitFactor(trades),
      riskStatus,
      bestStrategyId,
    };
  }

  getEquityCurve(compare: "paper" | "real", range: Range): EquityPointDto[] {
    const sinceMs = rangeSinceMs(range);
    const paper = this.store.listPnlSnapshots({ env: "PAPER", strategyId: null, sinceMs });
    const real = this.store.listPnlSnapshots({ env: "REAL", strategyId: null, sinceMs });
    const map = new Map<string, EquityPointDto>();

    for (const row of paper) {
      const key = row.timestamp;
      const current = map.get(key) ?? { ts: key };
      current.paperEquity = row.equity;
      map.set(key, current);
    }
    for (const row of real) {
      const key = row.timestamp;
      const current = map.get(key) ?? { ts: key };
      current.realEquity = row.equity;
      map.set(key, current);
    }

    const points = [...map.values()].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    if (compare === "paper") {
      return points.map((item) => ({ ts: item.ts, paperEquity: item.paperEquity }));
    }
    return points;
  }

  getStrategyLeaderboard(env: Environment, range: Range): StrategyLeaderboardRowDto[] {
    const sinceMs = rangeSinceMs(range);
    const strategies = this.store.listStrategies();
    return strategies
      .map<StrategyLeaderboardRowDto>((strategy) => {
        const orders = this.store.listOrders({ env, strategyId: strategy.id, sinceMs, limit: 5000 });
        const trades: ClosedTrade[] = orders.map((item) => ({ pnl: item.pnl, closedAt: item.createdAt }));
        const pnlPoints = this.store
          .listPnlSnapshots({ env, strategyId: strategy.id, sinceMs })
          .map<TimePoint>((item) => ({ ts: item.timestamp, equity: item.equity }));
        const return7d = orders.reduce((sum, item) => sum + item.pnl, 0);
        const capitalUsage = orders.reduce((sum, item) => sum + item.amount, 0);
        const winRate = calcWinRate(trades);
        const pf = calcProfitFactor(trades);
        const dd = calcMaxDrawdown(pnlPoints);

        const grade: "A" | "B" | "C" =
          winRate >= 60 && pf >= 1.8 && dd <= 10 ? "A" : winRate >= 50 && pf >= 1.2 && dd <= 20 ? "B" : "C";

        const canRequestReal = strategy.status === "eligible";
        return {
          strategyId: strategy.id,
          strategyName: strategy.name,
          status: strategy.status,
          return7d: Number(return7d.toFixed(4)),
          winRate,
          profitFactor: pf,
          maxDrawdown: dd,
          capitalUsage: Number(capitalUsage.toFixed(4)),
          grade,
          canRequestReal,
        };
      })
      .sort((a, b) => b.return7d - a.return7d);
  }

  getExposures(env: Environment, _range: Range): ExposureDto {
    const latest = this.store.latestExposure(env);
    if (!latest) {
      return {
        city: [],
        date: [],
        correlationBuckets: [],
        tailRisk: [{ level: "info", message: "暂无暴露快照" }],
      };
    }
    const city = Object.entries(latest.byCity).map(([name, value]) => ({ name, value }));
    const date = Object.entries(latest.byDate).map(([key, value]) => ({ key, value }));
    const correlationBuckets = Object.entries(latest.correlationBucket).map(([bucket, value]) => ({ bucket, value }));
    const tailRisk: ExposureDto["tailRisk"] = [];

    const topCity = [...city].sort((a, b) => b.value - a.value)[0];
    if (topCity && topCity.value >= 40) {
      tailRisk.push({ level: "critical", message: `城市暴露过高：${topCity.name} ${topCity.value.toFixed(2)}%` });
    }
    const topBucket = [...correlationBuckets].sort((a, b) => b.value - a.value)[0];
    if (topBucket && topBucket.value >= 60) {
      tailRisk.push({ level: "warning", message: `相关性集中风险：${topBucket.bucket} ${topBucket.value.toFixed(2)}%` });
    }
    if (tailRisk.length === 0) {
      tailRisk.push({ level: "info", message: "当前暴露结构在阈值内" });
    }

    return {
      city,
      date,
      correlationBuckets,
      tailRisk,
    };
  }

  async getHealth(env: Environment, range: Range, strategyId?: string): Promise<HealthPanelDto> {
    const sinceMs = rangeSinceMs(range);
    const signals = this.store.listSignals({ env, strategyId, limit: 1000, sinceMs });
    const recentSignals = signals.slice(0, 50);
    const orders = this.store.listOrders({ env, strategyId, sinceMs, limit: 1000 });
    const riskEvents = this.store.listRiskEvents({ env, strategyId, sinceMs, limit: 1000 });
    const markets = await this.markets.getMarkets();

    const winSignals = recentSignals.filter((sig) => {
      const match = orders.find((ord) => ord.marketId === sig.marketId && ord.createdAt >= sig.createdAt);
      return (match?.pnl ?? 0) > 0;
    }).length;
    const signalWinRate50 = recentSignals.length > 0 ? Number(((winSignals / recentSignals.length) * 100).toFixed(4)) : 0;

    const latencies = recentSignals.map((sig) => {
      const mark = markets.find((item) => item.id === sig.marketId);
      if (!mark) return 400;
      return Math.max(20, Math.round((1 - sig.confidence) * 500));
    });
    const sortedLat = [...latencies].sort((a, b) => a - b);
    const p95Index = sortedLat.length ? Math.floor(sortedLat.length * 0.95) : 0;
    const signalLatencyMsP95 = sortedLat[p95Index] ?? 0;

    const avgSlippageBps =
      orders.length === 0 ? 0 : Number((orders.reduce((sum, ord) => sum + (ord.fee / Math.max(ord.amount, 1)) * 10000, 0) / orders.length).toFixed(4));
    const rejects = orders.filter((item) => item.status === "rejected").length;
    const orderRejectRate = orders.length === 0 ? 0 : Number(((rejects / orders.length) * 100).toFixed(4));

    const apiErrors = riskEvents.filter((item) => item.type === "api_error").length;
    const timeouts = riskEvents.filter(
      (item) => item.type === "api_error" && String(item.payload.reason ?? "").includes("timeout"),
    ).length;
    const apiErrorRate = orders.length === 0 ? 0 : Number(((apiErrors / Math.max(orders.length, 1)) * 100).toFixed(4));
    const apiTimeoutRate = orders.length === 0 ? 0 : Number(((timeouts / Math.max(orders.length, 1)) * 100).toFixed(4));

    return {
      signalWinRate50,
      signalLatencyMsP95,
      avgSlippageBps,
      orderRejectRate,
      apiErrorRate,
      apiTimeoutRate,
    };
  }

  getTopSignals(env: Environment, limit: number): TopSignalDto[] {
    return this.store.listTopSignals({ env, limit, sinceMs: Date.now() - DAY_MS * 2 });
  }
}
