import { BadRequestException, Injectable, OnModuleDestroy } from "@nestjs/common";
import type {
  Environment,
  MarketDto,
  StartStrategyRequestDto,
  StrategyRuntimeStatusDto,
  StrategySignalPreviewDto,
} from "@weather-trader/shared";
import { EventsGateway } from "../../gateway/events.gateway";
import { ControlStoreService } from "../control/control.store";
import { ControlStrategyGovernanceService } from "../control/control.strategy-governance.service";
import { ExecutionApplicationService } from "../execution/execution-application.service";
import { MarketsService } from "../markets/markets.service";
import { SystemService } from "../system/system.service";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";

type StrategySignalCandidate = Omit<StrategySignalPreviewDto, "createdAt">;

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class StrategyService implements OnModuleDestroy {
  private config: UpdateStrategyDto = {
    strategyId: "strategy-default-001",
    model: "mean_reversion",
    autoTradeEnabled: false,
    triggerThreshold: 0.65,
    updateFrequencySec: 5,
    maxDailyLoss: 1000,
    maxPositionSize: 5000,
    maxOpenPositions: 3,
    slippageBps: 50,
  };
  private activeRunId: string | null = null;

  private runtime: StrategyRuntimeStatusDto = {
    running: false,
    environment: null,
    activeStrategyId: null,
    activeWalletId: null,
    startedAt: null,
    stoppedAt: null,
    lastTickAt: null,
    nextTickAt: null,
    ticks: 0,
    signals: 0,
    executedOrders: 0,
    rejectedOrders: 0,
    sessionPnl: 0,
    lastSignal: null,
    lastError: null,
  };

  private runner: NodeJS.Timeout | null = null;

  constructor(
    private readonly events: EventsGateway,
    private readonly system: SystemService,
    private readonly markets: MarketsService,
    private readonly execution: ExecutionApplicationService,
    private readonly controlStore: ControlStoreService,
    private readonly governance: ControlStrategyGovernanceService,
  ) {}

  onModuleDestroy(): void {
    this.stopRunner("module_destroy");
  }

  getConfig() {
    return this.deepClone(this.config);
  }

  getRuntime(): StrategyRuntimeStatusDto {
    const environment = this.system.getEnvironment();
    this.runtime.environment = environment;
    this.runtime.sessionPnl = this.computeSessionPnl(environment);
    return this.deepClone(this.runtime);
  }

  updateConfig(next: UpdateStrategyDto) {
    const previous = this.config;
    this.config = this.deepClone({
      ...next,
      strategyId: next.strategyId ?? previous.strategyId ?? this.controlStore.getDefaultStrategyId(),
    });
    this.events.emitSystemLog({ level: "info", message: "Strategy config updated", payload: next });

    if (!next.autoTradeEnabled && this.runtime.running) {
      this.stopRunner("auto_trade_disabled");
    } else if (this.runtime.running && previous.updateFrequencySec !== next.updateFrequencySec) {
      this.scheduleRunner();
      this.runtime.nextTickAt = new Date(Date.now() + next.updateFrequencySec * 1000).toISOString();
      this.events.emitSystemLog({
        level: "info",
        message: "Strategy runner interval updated",
        payload: { updateFrequencySec: next.updateFrequencySec },
      });
    }

    return this.getConfig();
  }

  start(startOptions: StartStrategyRequestDto = {}): StrategyRuntimeStatusDto {
    if (this.runtime.running) {
      return this.getRuntime();
    }

    if (!this.config.autoTradeEnabled) {
      throw new BadRequestException("auto_trade_not_enabled");
    }

    const environment = this.system.getEnvironment();
    const profile = this.system.ensureExecutionReady(environment);
    const strategyId = startOptions.strategyId?.trim() || this.config.strategyId || this.controlStore.getDefaultStrategyId();
    const walletId = startOptions.walletId?.trim() || profile.wallet.address;
    if (walletId !== profile.wallet.address) {
      throw new BadRequestException("wallet_not_available_in_environment");
    }

    if (this.config.strategyId !== strategyId) {
      this.config = this.deepClone({
        ...this.config,
        strategyId,
      });
    }

    if (environment === "REAL") {
      this.governance.assertRealAutoTradingAllowed(strategyId);
    }
    this.controlStore.patchStrategy(strategyId, {
      status: environment === "REAL" ? "real_small" : "paper_testing",
    });
    const run = this.controlStore.createRun({
      strategyId,
      env: environment,
      configJson: this.config as unknown as Record<string, unknown>,
      gitCommit: process.env.GIT_COMMIT_SHA ?? null,
    });
    this.activeRunId = run.id;

    this.runtime.running = true;
    this.runtime.environment = environment;
    this.runtime.activeStrategyId = strategyId;
    this.runtime.activeWalletId = walletId;
    this.runtime.startedAt = new Date().toISOString();
    this.runtime.stoppedAt = null;
    this.runtime.lastError = null;
    this.runtime.nextTickAt = new Date(Date.now() + this.config.updateFrequencySec * 1000).toISOString();
    this.scheduleRunner();

    this.events.emitSystemLog({
      level: "info",
      message: "Strategy runner started",
      payload: {
        environment,
        strategyId,
        walletId,
        runId: run.id,
        model: this.config.model,
        triggerThreshold: this.config.triggerThreshold,
        updateFrequencySec: this.config.updateFrequencySec,
      },
    });

    void this.runCycle();
    return this.getRuntime();
  }

  stop(): StrategyRuntimeStatusDto {
    this.stopRunner("manual_stop");
    return this.getRuntime();
  }

  async runCycleNow(): Promise<StrategyRuntimeStatusDto> {
    await this.runCycle();
    return this.getRuntime();
  }

  private scheduleRunner(): void {
    if (this.runner) {
      clearInterval(this.runner);
    }
    this.runner = setInterval(() => {
      void this.runCycle();
    }, this.config.updateFrequencySec * 1000);
  }

  private stopRunner(reason: string): void {
    if (this.runner) {
      clearInterval(this.runner);
      this.runner = null;
    }

    if (this.runtime.running) {
      if (this.activeRunId) {
        this.controlStore.closeRun(this.activeRunId);
        this.activeRunId = null;
      }
      this.runtime.running = false;
      this.runtime.stoppedAt = new Date().toISOString();
      this.runtime.nextTickAt = null;
      this.runtime.activeStrategyId = null;
      this.runtime.activeWalletId = null;
      this.events.emitSystemLog({
        level: "info",
        message: "Strategy runner stopped",
        payload: { reason },
      });
    }
  }

  private async runCycle(): Promise<void> {
    if (!this.runtime.running) {
      return;
    }

    if (!this.config.autoTradeEnabled) {
      this.stopRunner("auto_trade_disabled");
      return;
    }

    const environment = this.system.getEnvironment();
    this.runtime.environment = environment;
    this.runtime.ticks += 1;
    this.runtime.lastTickAt = new Date().toISOString();
    this.runtime.nextTickAt = new Date(Date.now() + this.config.updateFrequencySec * 1000).toISOString();

    try {
      const profile = this.system.ensureExecutionReady(environment);
      const activeWalletId = this.runtime.activeWalletId ?? profile.wallet.address;
      if (activeWalletId !== profile.wallet.address) {
        throw new BadRequestException("active_wallet_out_of_sync");
      }
      const dailyLoss = this.computeDailyRealizedLoss(environment);

      if (dailyLoss >= this.config.maxDailyLoss) {
        this.runtime.lastError = "daily_loss_limit_reached";
        this.events.emitRiskAlert({
          type: "daily_loss_limit_reached",
          environment,
          dailyLoss,
          maxDailyLoss: this.config.maxDailyLoss,
        });
        return;
      }

      const markets = await this.markets.getMarkets();
      const signal = this.pickSignal(markets, profile.wallet.balance, environment);
      if (!signal) {
        return;
      }
      const strategyId = this.runtime.activeStrategyId ?? this.config.strategyId ?? this.controlStore.getDefaultStrategyId();
      const runId = this.activeRunId ?? this.controlStore.createRun({
        strategyId,
        env: environment,
        configJson: this.config as unknown as Record<string, unknown>,
        gitCommit: process.env.GIT_COMMIT_SHA ?? null,
      }).id;

      const createdAt = new Date().toISOString();
      this.runtime.signals += 1;
      this.runtime.lastSignal = {
        ...signal,
        createdAt,
      };

      const signalRow = this.controlStore.addSignal({
        strategyId,
        runId,
        env: environment,
        marketId: signal.marketId,
        side: signal.side === "buy" ? "long" : "short",
        modelProb: signal.confidence,
        marketProb: signal.odds,
        expectedEdge: Number((signal.confidence - signal.odds).toFixed(6)),
        confidence: signal.confidence,
        recommendedSize: signal.quantity,
        createdAt,
      });

      await this.execution.create({
        marketId: signal.marketId,
        side: signal.side,
        quantity: signal.quantity,
        price: signal.odds,
        environment,
        strategyId,
        runId,
        walletId: activeWalletId,
        orderType: "limit",
        slippageBps: this.config.slippageBps,
      });

      this.runtime.executedOrders += 1;
      this.runtime.sessionPnl = this.computeSessionPnl(environment);
      this.runtime.lastError = null;

      if (environment === "PAPER") {
        const eligibility = this.governance.evaluateEligibility(strategyId);
        if (eligibility.eligible) {
          this.controlStore.patchStrategy(strategyId, { status: "eligible" });
        } else {
          this.controlStore.patchStrategy(strategyId, { status: "paper_testing" });
        }
      }

      this.events.emitSystemLog({
        level: "info",
        message: "Strategy signal executed",
        payload: {
          signalId: signalRow.id,
          strategyId,
          runId,
        },
      });
    } catch (error) {
      this.runtime.rejectedOrders += 1;
      const reason = this.resolveErrorCode(error);
      this.runtime.lastError = reason;
      this.events.emitRiskAlert({
        type: "strategy_order_rejected",
        environment,
        reason,
      });
      this.events.emitSystemLog({
        level: "warning",
        message: "Strategy cycle rejected",
        payload: {
          environment,
          reason,
        },
      });
    }
  }

  private pickSignal(markets: MarketDto[], walletBalance: number, environment: Environment): StrategySignalCandidate | null {
    const lower = Math.max(0.01, Number((1 - this.config.triggerThreshold).toFixed(4)));
    const upper = Math.min(0.99, Number(this.config.triggerThreshold.toFixed(4)));
    const baseNotional = Math.min(this.config.maxPositionSize, walletBalance * 0.08);
    if (baseNotional <= 0) {
      return null;
    }

    const recent = this.execution.list({ environment, limit: 300 });
    const usedSymbols = new Set(recent.map((item) => item.marketId));
    const usedCount = usedSymbols.size;

    const candidates = markets
      .map<StrategySignalCandidate | null>((market) => {
        const sideAndReason = this.resolveSignalSide(market, lower, upper);
        if (!sideAndReason) {
          return null;
        }

        const quantity = Number((baseNotional / Math.max(0.01, market.odds)).toFixed(4));
        if (quantity <= 0) {
          return null;
        }

        if (usedCount >= this.config.maxOpenPositions && !usedSymbols.has(market.id)) {
          return null;
        }

        const distance = Math.max(Math.abs(market.odds - upper), Math.abs(market.odds - lower));
        const momentum = Math.min(1, Math.abs(market.change24h) / 20);
        const confidence = Math.min(1, Number(((distance * 2 + momentum) / 2).toFixed(4)));

        return {
          marketId: market.id,
          side: sideAndReason.side,
          model: this.config.model,
          confidence,
          odds: market.odds,
          change24h: market.change24h,
          reason: sideAndReason.reason,
          quantity,
        };
      })
      .filter((item): item is StrategySignalCandidate => item !== null)
      .sort((a, b) => {
        if (b.confidence !== a.confidence) {
          return b.confidence - a.confidence;
        }
        return Math.abs(b.change24h) - Math.abs(a.change24h);
      });

    return candidates[0] ?? null;
  }

  private resolveSignalSide(
    market: MarketDto,
    lower: number,
    upper: number,
  ): { side: "buy" | "sell"; reason: string } | null {
    if (this.config.model === "trend_following") {
      if (market.odds >= upper && market.change24h >= 0) {
        return { side: "buy", reason: "trend_up_breakout" };
      }
      if (market.odds <= lower && market.change24h <= 0) {
        return { side: "sell", reason: "trend_down_breakout" };
      }
      return null;
    }

    if (market.odds >= upper) {
      return { side: "sell", reason: "mean_reversion_overheat" };
    }
    if (market.odds <= lower) {
      return { side: "buy", reason: "mean_reversion_oversold" };
    }
    return null;
  }

  private computeSessionPnl(environment: Environment): number {
    if (!this.runtime.startedAt) {
      return 0;
    }

    const startedAtMs = new Date(this.runtime.startedAt).getTime();
    if (!Number.isFinite(startedAtMs)) {
      return 0;
    }

    const pnl = this.execution
      .list({ environment, limit: 500 })
      .filter((item) => new Date(item.createdAt).getTime() >= startedAtMs)
      .reduce((sum, item) => sum + item.pnl, 0);

    return Number(pnl.toFixed(4));
  }

  private computeDailyRealizedLoss(environment: Environment): number {
    const since = Date.now() - DAY_MS;
    const totalLoss = this.execution
      .list({ environment, limit: 500 })
      .filter((item) => new Date(item.createdAt).getTime() >= since)
      .reduce((sum, item) => sum + Math.min(0, item.pnl), 0);

    return Number(Math.abs(totalLoss).toFixed(4));
  }

  private resolveErrorCode(error: unknown): string {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (typeof response === "string") {
        return response;
      }
      if (response && typeof response === "object") {
        const maybeMessage = (response as { message?: string | string[] }).message;
        if (Array.isArray(maybeMessage) && maybeMessage[0]) {
          return maybeMessage[0];
        }
        if (typeof maybeMessage === "string") {
          return maybeMessage;
        }
      }
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "strategy_cycle_error";
  }

  private deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
