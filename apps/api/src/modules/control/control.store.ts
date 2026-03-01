import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { Injectable, Logger } from "@nestjs/common";
import type {
  AllocationSnapshotDto,
  Environment,
  StrategyApprovalDto,
  StrategyLifecycleStatus,
  StrategyProfileDto,
  TopSignalDto,
} from "@weather-trader/shared";

export type Env = Environment;

export type StrategyRunRecord = {
  id: string;
  strategyId: string;
  env: Env;
  startAt: string;
  endAt: string | null;
  configJson: Record<string, unknown>;
  gitCommit: string | null;
};

export type SignalRecord = {
  id: string;
  strategyId: string;
  runId: string;
  env: Env;
  marketId: string;
  side: "long" | "short";
  modelProb: number;
  marketProb: number;
  expectedEdge: number;
  confidence: number;
  recommendedSize: number;
  createdAt: string;
};

export type OrderRecord = {
  id: string;
  env: Env;
  walletId: string;
  strategyId: string | null;
  runId: string | null;
  marketId: string;
  side: "long" | "short";
  type: "limit" | "market";
  price: number;
  size: number;
  status: "accepted" | "partial_filled" | "filled" | "canceled" | "rejected";
  createdAt: string;
  fee: number;
  pnl: number;
  amount: number;
};

export type FillRecord = {
  id: string;
  orderId: string;
  env: Env;
  price: number;
  size: number;
  fee: number;
  filledAt: string;
};

export type PnlSnapshotRecord = {
  id: string;
  env: Env;
  strategyId: string | null;
  timestamp: string;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  equity: number;
};

export type RiskEventRecord = {
  id: string;
  env: Env;
  scope: "portfolio" | "strategy" | "market";
  strategyId: string | null;
  marketId: string | null;
  type: "limit_hit" | "drawdown" | "api_error" | "slippage_spike" | "manual_stop" | "env_switch";
  severity: "low" | "medium" | "high" | "critical";
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ExposureSnapshotRecord = {
  id: string;
  env: Env;
  timestamp: string;
  byCity: Record<string, number>;
  byDate: Record<string, number>;
  correlationBucket: Record<string, number>;
};

type ControlState = {
  version: 1;
  seq: number;
  strategies: StrategyProfileDto[];
  runs: StrategyRunRecord[];
  signals: SignalRecord[];
  orders: OrderRecord[];
  fills: FillRecord[];
  pnlSnapshots: PnlSnapshotRecord[];
  riskEvents: RiskEventRecord[];
  exposureSnapshots: ExposureSnapshotRecord[];
  approvals: StrategyApprovalDto[];
  allocations: AllocationSnapshotDto[];
};

const DEFAULT_STRATEGY_ID = "strategy-default-001";
const STORE_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

@Injectable()
export class ControlStoreService {
  private readonly logger = new Logger(ControlStoreService.name);
  private readonly storePath = resolve(process.cwd(), process.env.CONTROL_STORE_PATH ?? "runtime/control-store.json");
  private readonly persistenceEnabled = process.env.CONTROL_PERSISTENCE !== "off" && process.env.NODE_ENV !== "test";
  private state: ControlState = {
    version: STORE_VERSION,
    seq: 1,
    strategies: [],
    runs: [],
    signals: [],
    orders: [],
    fills: [],
    pnlSnapshots: [],
    riskEvents: [],
    exposureSnapshots: [],
    approvals: [],
    allocations: [],
  };

  constructor() {
    if (this.persistenceEnabled) {
      this.restore();
    }
    this.ensureBootstrapData();
  }

  listStrategies(): StrategyProfileDto[] {
    return this.deepClone(this.state.strategies);
  }

  getStrategy(strategyId: string): StrategyProfileDto | null {
    return this.state.strategies.find((item) => item.id === strategyId) ?? null;
  }

  getDefaultStrategyId(): string {
    return this.state.strategies[0]?.id ?? DEFAULT_STRATEGY_ID;
  }

  patchStrategy(strategyId: string, patch: Partial<StrategyProfileDto>): StrategyProfileDto {
    const current = this.getStrategy(strategyId);
    if (!current) {
      const created = this.createStrategy({
        id: strategyId,
        name: patch.name ?? strategyId,
        status: patch.status ?? "dev",
      });
      return created;
    }
    const next: StrategyProfileDto = {
      ...current,
      ...patch,
      updatedAt: nowIso(),
    };
    this.state.strategies = this.state.strategies.map((item) => (item.id === strategyId ? next : item));
    this.persist();
    return this.deepClone(next);
  }

  createStrategy(input: { id?: string; name: string; status?: StrategyLifecycleStatus }): StrategyProfileDto {
    const ts = nowIso();
    const strategy: StrategyProfileDto = {
      id: input.id ?? this.nextId("S"),
      name: input.name,
      version: 1,
      status: input.status ?? "dev",
      createdAt: ts,
      updatedAt: ts,
    };
    this.state.strategies.unshift(strategy);
    this.persist();
    return this.deepClone(strategy);
  }

  createRun(input: {
    strategyId: string;
    env: Env;
    configJson: Record<string, unknown>;
    gitCommit?: string | null;
  }): StrategyRunRecord {
    const run: StrategyRunRecord = {
      id: this.nextId("RUN"),
      strategyId: input.strategyId,
      env: input.env,
      startAt: nowIso(),
      endAt: null,
      configJson: this.deepClone(input.configJson),
      gitCommit: input.gitCommit ?? null,
    };
    this.state.runs.unshift(run);
    this.persist();
    return this.deepClone(run);
  }

  closeRun(runId: string): void {
    this.state.runs = this.state.runs.map((item) => (item.id === runId ? { ...item, endAt: nowIso() } : item));
    this.persist();
  }

  listRuns(strategyId?: string, env?: Env): StrategyRunRecord[] {
    return this.state.runs.filter((item) => (!strategyId || item.strategyId === strategyId) && (!env || item.env === env));
  }

  addSignal(input: Omit<SignalRecord, "id" | "createdAt"> & { createdAt?: string }): SignalRecord {
    const row: SignalRecord = {
      ...input,
      id: this.nextId("SIG"),
      createdAt: input.createdAt ?? nowIso(),
    };
    this.state.signals.unshift(row);
    this.persist();
    return this.deepClone(row);
  }

  listSignals(params: { env?: Env; strategyId?: string; limit?: number; sinceMs?: number } = {}): SignalRecord[] {
    const since = params.sinceMs ?? 0;
    return this.state.signals
      .filter(
        (item) =>
          (!params.env || item.env === params.env) &&
          (!params.strategyId || item.strategyId === params.strategyId) &&
          new Date(item.createdAt).getTime() >= since,
      )
      .slice(0, params.limit ?? 500);
  }

  addOrder(input: Omit<OrderRecord, "createdAt"> & { createdAt?: string }): OrderRecord {
    const row: OrderRecord = {
      ...input,
      createdAt: input.createdAt ?? nowIso(),
    };
    this.state.orders.unshift(row);
    this.persist();
    return this.deepClone(row);
  }

  patchOrder(orderId: string, patch: Partial<Pick<OrderRecord, "status" | "fee" | "pnl" | "amount">>): OrderRecord | null {
    const current = this.state.orders.find((item) => item.id === orderId);
    if (!current) {
      return null;
    }
    const next: OrderRecord = {
      ...current,
      ...patch,
    };
    this.state.orders = this.state.orders.map((item) => (item.id === orderId ? next : item));
    this.persist();
    return this.deepClone(next);
  }

  listOrders(params: { env?: Env; strategyId?: string; limit?: number; sinceMs?: number } = {}): OrderRecord[] {
    const since = params.sinceMs ?? 0;
    return this.state.orders
      .filter(
        (item) =>
          (!params.env || item.env === params.env) &&
          (!params.strategyId || item.strategyId === params.strategyId) &&
          new Date(item.createdAt).getTime() >= since,
      )
      .slice(0, params.limit ?? 2000);
  }

  addFill(input: Omit<FillRecord, "id" | "filledAt"> & { filledAt?: string }): FillRecord {
    const row: FillRecord = {
      ...input,
      id: this.nextId("FILL"),
      filledAt: input.filledAt ?? nowIso(),
    };
    this.state.fills.unshift(row);
    this.persist();
    return this.deepClone(row);
  }

  listFills(params: { env?: Env; orderId?: string; sinceMs?: number } = {}): FillRecord[] {
    const since = params.sinceMs ?? 0;
    return this.state.fills.filter(
      (item) =>
        (!params.env || item.env === params.env) &&
        (!params.orderId || item.orderId === params.orderId) &&
        new Date(item.filledAt).getTime() >= since,
    );
  }

  addPnlSnapshot(input: Omit<PnlSnapshotRecord, "id">): PnlSnapshotRecord {
    const row: PnlSnapshotRecord = {
      ...input,
      id: this.nextId("PNL"),
    };
    this.state.pnlSnapshots.unshift(row);
    this.persist();
    return this.deepClone(row);
  }

  listPnlSnapshots(params: { env?: Env; strategyId?: string | null; sinceMs?: number } = {}): PnlSnapshotRecord[] {
    const since = params.sinceMs ?? 0;
    return this.state.pnlSnapshots
      .filter(
        (item) =>
          (!params.env || item.env === params.env) &&
          (params.strategyId === undefined || item.strategyId === params.strategyId) &&
          new Date(item.timestamp).getTime() >= since,
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  addRiskEvent(input: Omit<RiskEventRecord, "id" | "createdAt"> & { createdAt?: string }): RiskEventRecord {
    const row: RiskEventRecord = {
      ...input,
      id: this.nextId("RISK"),
      createdAt: input.createdAt ?? nowIso(),
    };
    this.state.riskEvents.unshift(row);
    this.persist();
    return this.deepClone(row);
  }

  listRiskEvents(params: { env?: Env; strategyId?: string; sinceMs?: number; limit?: number } = {}): RiskEventRecord[] {
    const since = params.sinceMs ?? 0;
    return this.state.riskEvents
      .filter(
        (item) =>
          (!params.env || item.env === params.env) &&
          (!params.strategyId || item.strategyId === params.strategyId) &&
          new Date(item.createdAt).getTime() >= since,
      )
      .slice(0, params.limit ?? 500);
  }

  addExposureSnapshot(input: Omit<ExposureSnapshotRecord, "id">): ExposureSnapshotRecord {
    const row: ExposureSnapshotRecord = {
      ...input,
      id: this.nextId("EXP"),
    };
    this.state.exposureSnapshots.unshift(row);
    this.persist();
    return this.deepClone(row);
  }

  latestExposure(env: Env): ExposureSnapshotRecord | null {
    return this.state.exposureSnapshots.find((item) => item.env === env) ?? null;
  }

  addApproval(input: Omit<StrategyApprovalDto, "id" | "createdAt">): StrategyApprovalDto {
    const row: StrategyApprovalDto = {
      ...input,
      id: this.nextId("APR"),
      createdAt: nowIso(),
    };
    this.state.approvals.unshift(row);
    this.persist();
    return this.deepClone(row);
  }

  listApprovals(strategyId: string): StrategyApprovalDto[] {
    return this.state.approvals.filter((item) => item.strategyId === strategyId);
  }

  latestApproval(strategyId: string): StrategyApprovalDto | null {
    return this.state.approvals.find((item) => item.strategyId === strategyId) ?? null;
  }

  addAllocation(input: Omit<AllocationSnapshotDto, "timestamp"> & { timestamp?: string }): AllocationSnapshotDto {
    const row: AllocationSnapshotDto = {
      ...input,
      timestamp: input.timestamp ?? nowIso(),
    };
    this.state.allocations.unshift(row);
    this.persist();
    return this.deepClone(row);
  }

  latestAllocation(strategyId: string, env: Env): AllocationSnapshotDto | null {
    return this.state.allocations.find((item) => item.strategyId === strategyId && item.env === env) ?? null;
  }

  listAllocations(params: { env?: Env; strategyId?: string; sinceMs?: number } = {}): AllocationSnapshotDto[] {
    const since = params.sinceMs ?? 0;
    return this.state.allocations.filter(
      (item) =>
        (!params.env || item.env === params.env) &&
        (!params.strategyId || item.strategyId === params.strategyId) &&
        new Date(item.timestamp).getTime() >= since,
    );
  }

  listTopSignals(params: { env: Env; limit: number; sinceMs?: number }): TopSignalDto[] {
    const since = params.sinceMs ?? 0;
    return this.state.signals
      .filter((item) => item.env === params.env && new Date(item.createdAt).getTime() >= since)
      .map<TopSignalDto>((item) => ({
        signalId: item.id,
        strategyId: item.strategyId,
        marketId: item.marketId,
        side: item.side,
        modelProb: item.modelProb,
        marketProb: item.marketProb,
        edge: item.expectedEdge,
        confidence: item.confidence,
        recommendedSize: item.recommendedSize,
        liquidityScore: Number(Math.max(0, 100 - Math.abs(item.expectedEdge) * 200).toFixed(2)),
        expectedSlippageBps: Number((Math.max(4, 40 - item.confidence * 20) + Math.abs(item.expectedEdge) * 120).toFixed(2)),
        riskAdjustedScore: Number((item.expectedEdge * item.confidence * 100).toFixed(4)),
        createdAt: item.createdAt,
      }))
      .sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore)
      .slice(0, params.limit);
  }

  private ensureBootstrapData(): void {
    if (this.state.strategies.length === 0) {
      const ts = nowIso();
      this.state.strategies.push({
        id: DEFAULT_STRATEGY_ID,
        name: "Weather Mean Reversion",
        version: 1,
        status: "paper_testing",
        createdAt: ts,
        updatedAt: ts,
      });
      this.persist();
    }
  }

  private nextId(prefix: string): string {
    const id = `${prefix}-${Date.now()}-${this.state.seq++}`;
    return id;
  }

  private restore(): void {
    try {
      if (!existsSync(this.storePath)) {
        return;
      }
      const raw = readFileSync(this.storePath, "utf8");
      const data = JSON.parse(raw) as Partial<ControlState>;
      if (data.version !== STORE_VERSION) {
        return;
      }
      this.state = {
        version: STORE_VERSION,
        seq: typeof data.seq === "number" ? data.seq : 1,
        strategies: Array.isArray(data.strategies) ? data.strategies : [],
        runs: Array.isArray(data.runs) ? data.runs : [],
        signals: Array.isArray(data.signals) ? data.signals : [],
        orders: Array.isArray(data.orders) ? data.orders : [],
        fills: Array.isArray(data.fills) ? data.fills : [],
        pnlSnapshots: Array.isArray(data.pnlSnapshots) ? data.pnlSnapshots : [],
        riskEvents: Array.isArray(data.riskEvents) ? data.riskEvents : [],
        exposureSnapshots: Array.isArray(data.exposureSnapshots) ? data.exposureSnapshots : [],
        approvals: Array.isArray(data.approvals) ? data.approvals : [],
        allocations: Array.isArray(data.allocations) ? data.allocations : [],
      };
      this.logger.log(
        `Control store restored: strategies=${this.state.strategies.length}, orders=${this.state.orders.length}`,
      );
    } catch (error) {
      this.logger.warn(`Control store restore failed: ${(error as Error).message}`);
    }
  }

  private persist(): void {
    if (!this.persistenceEnabled) {
      return;
    }
    try {
      mkdirSync(dirname(this.storePath), { recursive: true });
      writeFileSync(this.storePath, JSON.stringify(this.state, null, 2), "utf8");
    } catch (error) {
      this.logger.warn(`Control store persist failed: ${(error as Error).message}`);
    }
  }

  private deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
