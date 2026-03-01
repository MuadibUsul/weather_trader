import { describe, expect, it } from "vitest";
import { ControlStoreService } from "../control/control.store";
import { ControlStrategyGovernanceService } from "../control/control.strategy-governance.service";
import { StrategyService } from "./strategy.service";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";

class FakeEventsGateway {
  emitSystemLog(_payload: unknown) {}
  emitRiskAlert(_payload: unknown) {}
}

class FakeSystemService {
  private env: "REAL" | "PAPER" = "PAPER";
  private walletBalance: Record<"REAL" | "PAPER", number> = {
    REAL: 5000,
    PAPER: 100000,
  };

  setEnvironment(env: "REAL" | "PAPER") {
    this.env = env;
  }

  getEnvironment() {
    return this.env;
  }

  ensureExecutionReady(environment: "REAL" | "PAPER") {
    return {
      wallet: {
        label: environment,
        address: environment === "REAL" ? "0xabc0000000000000000000000000000000000001" : "paper://wallet/sim-001",
        balance: this.walletBalance[environment],
        unit: environment === "REAL" ? "USDC" : "V-USDC",
        connected: true,
        isSimulated: environment === "PAPER",
      },
      credential: {
        keyName: "test-key",
        healthy: true,
        lastHeartbeat: "just now",
        scope: "trade",
      },
    };
  }
}

class FakeMarketsService {
  async getMarkets() {
    return [
      { id: "NYC_GT_85", title: "NYC > 29.4°C", location: "纽约", odds: 0.72, change24h: 8.1, oi: 100000, live: true },
      { id: "NYC_LT_75", title: "NYC < 23.9°C", location: "纽约", odds: 0.2, change24h: -7.3, oi: 80000, live: true },
    ];
  }
}

class FakeExecutionService {
  private seq = 1;
  private readonly orders: Array<{
    id: string;
    marketId: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    amount: number;
    fee: number;
    pnl: number;
    environment: "REAL" | "PAPER";
    status: "filled";
    createdAt: string;
  }> = [];

  list(query: { environment?: "REAL" | "PAPER"; limit?: number }) {
    const base = query.environment ? this.orders.filter((item) => item.environment === query.environment) : this.orders;
    return base.slice(0, query.limit ?? 500);
  }

  create(input: {
    marketId: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    environment?: "REAL" | "PAPER";
  }) {
    const order = {
      id: `T-${this.seq++}`,
      marketId: input.marketId,
      side: input.side,
      quantity: input.quantity,
      price: input.price,
      amount: Number((input.quantity * input.price).toFixed(4)),
      fee: 0,
      pnl: input.side === "buy" ? 1 : -0.5,
      environment: input.environment ?? "PAPER",
      status: "filled" as const,
      createdAt: new Date().toISOString(),
    };
    this.orders.unshift(order);
    return order;
  }
}

const baseConfig: UpdateStrategyDto = {
  strategyId: "strategy-default-001",
  model: "mean_reversion",
  autoTradeEnabled: true,
  triggerThreshold: 0.65,
  updateFrequencySec: 5,
  maxDailyLoss: 1000,
  maxPositionSize: 5000,
  maxOpenPositions: 3,
  slippageBps: 50,
};

describe("StrategyService runtime", () => {
  it("rejects start when auto trade is disabled", () => {
    const store = new ControlStoreService();
    const governance = new ControlStrategyGovernanceService(store);
    const service = new StrategyService(
      new FakeEventsGateway() as never,
      new FakeSystemService() as never,
      new FakeMarketsService() as never,
      new FakeExecutionService() as never,
      store as never,
      governance as never,
    );

    try {
      expect(() => service.start()).toThrowError("auto_trade_not_enabled");
    } finally {
      service.onModuleDestroy();
    }
  });

  it("starts runner and produces strategy-driven orders", async () => {
    const store = new ControlStoreService();
    const governance = new ControlStrategyGovernanceService(store);
    const orders = new FakeExecutionService();
    const service = new StrategyService(
      new FakeEventsGateway() as never,
      new FakeSystemService() as never,
      new FakeMarketsService() as never,
      orders as never,
      store as never,
      governance as never,
    );

    try {
      service.updateConfig(baseConfig);
      const started = service.start();
      expect(started.running).toBe(true);

      await service.runCycleNow();
      const runtime = service.getRuntime();
      expect(runtime.signals).toBeGreaterThan(0);
      expect(runtime.executedOrders).toBeGreaterThan(0);

      const list = orders.list({ environment: "PAPER", limit: 20 });
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]?.marketId).toMatch(/NYC_/);
    } finally {
      service.onModuleDestroy();
    }
  });

  it("blocks REAL auto trading without approval", () => {
    const store = new ControlStoreService();
    const governance = new ControlStrategyGovernanceService(store);
    const system = new FakeSystemService();
    system.setEnvironment("REAL");

    const service = new StrategyService(
      new FakeEventsGateway() as never,
      system as never,
      new FakeMarketsService() as never,
      new FakeExecutionService() as never,
      store as never,
      governance as never,
    );

    try {
      service.updateConfig(baseConfig);
      expect(() => service.start()).toThrowError("strategy_real_not_approved");
    } finally {
      service.onModuleDestroy();
    }
  });

  it("rejects start when selected wallet is not current environment wallet", () => {
    const store = new ControlStoreService();
    const governance = new ControlStrategyGovernanceService(store);
    const system = new FakeSystemService();
    const service = new StrategyService(
      new FakeEventsGateway() as never,
      system as never,
      new FakeMarketsService() as never,
      new FakeExecutionService() as never,
      store as never,
      governance as never,
    );

    try {
      service.updateConfig(baseConfig);
      expect(() =>
        service.start({
          walletId: "0x9999000000000000000000000000000000000000",
        }),
      ).toThrowError("wallet_not_available_in_environment");
    } finally {
      service.onModuleDestroy();
    }
  });
});
