import { describe, expect, it } from "vitest";
import { existsSync, rmSync } from "fs";
import { resolve } from "path";
import { ControlAllocatorService } from "../control/control.allocator.service";
import { ControlRiskService } from "../control/control.risk.service";
import { ControlStoreService } from "../control/control.store";
import { ExecutionApplicationService } from "../execution/execution-application.service";
import { OrdersService } from "./orders.service";

class FakeEventsGateway {
  emitRiskAlert(_payload: unknown) {}
  emitOrderUpdate(_payload: unknown) {}
  emitSystemLog(_payload: unknown) {}
}

class FakeSystemService {
  private env: "REAL" | "PAPER" = "PAPER";
  private walletBalance: Record<"REAL" | "PAPER", number> = {
    REAL: 10_000,
    PAPER: 10_000,
  };

  setEnvironment(next: "REAL" | "PAPER") {
    this.env = next;
  }

  getEnvironment() {
    return this.env;
  }

  getProfile(environment: "REAL" | "PAPER") {
    return this.ensureExecutionReady(environment);
  }

  ensureExecutionReady(environment: "REAL" | "PAPER") {
    return {
      wallet: {
        label: environment === "REAL" ? "Real Wallet" : "Paper Wallet",
        address: environment === "REAL" ? "0xabc0000000000000000000000000000000000001" : "paper://wallet/sim-001",
        balance: this.walletBalance[environment],
        unit: environment === "REAL" ? "USDC" : "V-USDC",
        connected: true,
        isSimulated: environment === "PAPER",
      },
      credential: {
        keyName: "Unified_Key",
        healthy: true,
        lastHeartbeat: "just now",
        scope: "trade",
      },
    };
  }

  patchWallet(environment: "REAL" | "PAPER", patch: { balance?: number }) {
    if (typeof patch.balance === "number") {
      this.walletBalance[environment] = patch.balance;
    }
    return null;
  }

  recordAudit(_action: string, _status: "SUCCESS" | "FAILED", _detail: string, _environment: "REAL" | "PAPER") {
    return null;
  }
}

class FakeMarketsService {
  async getMarkets() {
    return [
      {
        id: "NYC_GT_85",
        title: "NYC > 29.4C",
        location: "New York",
        odds: 0.65,
        change24h: 0,
        oi: 100000,
        live: true,
        bestBid: 0.64,
        bestAsk: 0.66,
        source: "EXCHANGE" as const,
      },
    ];
  }
}

function expectOrderShape(order: unknown) {
  expect(order).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      walletId: expect.any(String),
      contractName: expect.any(String),
      marketId: expect.any(String),
      side: expect.stringMatching(/buy|sell/),
      quantity: expect.any(Number),
      price: expect.any(Number),
      amount: expect.any(Number),
      fee: expect.any(Number),
      pnl: expect.any(Number),
      environment: expect.stringMatching(/REAL|PAPER/),
      status: expect.stringMatching(/filled|open|cancelled/),
      createdAt: expect.any(String),
    }),
  );
  const typed = order as { id: string };
  expect(typed.id.length).toBeLessThanOrEqual(12);
}

describe("OrdersService contract", () => {
  function createService() {
    const store = new ControlStoreService();
    const execution = new ExecutionApplicationService(
      new FakeEventsGateway() as never,
      new FakeSystemService() as never,
      store as never,
      new ControlRiskService(store) as never,
      new ControlAllocatorService(store) as never,
      new FakeMarketsService() as never,
    );
    return new OrdersService(execution);
  }

  it("provides quote + preview for trading drawer", async () => {
    const service = createService();

    const quote = await service.quote({ marketId: "NYC_GT_85", environment: "PAPER" });
    expect(quote.bestBid).toBeGreaterThan(0);
    expect(quote.bestAsk).toBeGreaterThan(quote.bestBid);

    const preview = await service.preview({
      marketId: "NYC_GT_85",
      side: "buy",
      quantity: 100,
      price: quote.bestAsk,
      environment: "PAPER",
    });
    expect(preview.risk.pass).toBe(true);
    expect(preview.notional).toBeGreaterThan(0);
  });

  it("returns canonical order dto shape", async () => {
    const service = createService();

    const order = await service.create({
      marketId: "NYC_GT_85",
      side: "buy",
      quantity: 100,
      price: 0.6,
    });

    expectOrderShape(order);
    expect(order.environment).toBe("PAPER");

    const events = service.listEvents(order.id, 20);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((item) => item.type === "OrderRequested")).toBe(true);
  });

  it("supports list-open and cancel flow", async () => {
    const service = createService();

    const openOrder = await service.create({
      marketId: "NYC_GT_85",
      side: "buy",
      quantity: 50,
      price: 0.2,
      orderType: "limit",
    });
    expect(openOrder.status).toBe("open");

    const openRows = service.listOpen("PAPER");
    expect(openRows.some((item) => item.id === openOrder.id)).toBe(true);

    const canceled = await service.cancel(openOrder.id, "test_cancel");
    expect(canceled.status).toBe("cancelled");

    const afterOpenRows = service.listOpen("PAPER");
    expect(afterOpenRows.some((item) => item.id === openOrder.id)).toBe(false);
  });

  it("respects global mode and supports list filters", async () => {
    const store = new ControlStoreService();
    const system = new FakeSystemService();
    const execution = new ExecutionApplicationService(
      new FakeEventsGateway() as never,
      system as never,
      store as never,
      new ControlRiskService(store) as never,
      new ControlAllocatorService(store) as never,
      new FakeMarketsService() as never,
    );
    const service = new OrdersService(execution);

    await service.create({
      marketId: "NYC_GT_85",
      side: "buy",
      quantity: 10,
      price: 0.5,
    });

    system.setEnvironment("REAL");
    const realOrder = await service.create({
      marketId: "NYC_GT_85",
      side: "buy",
      quantity: 5,
      price: 0.6,
      environment: "REAL",
    });

    expectOrderShape(realOrder);
    expect(realOrder.environment).toBe("REAL");

    const realOnly = service.list({ environment: "REAL", limit: 20 });
    expect(realOnly.every((item) => item.environment === "REAL")).toBe(true);
  });

  it("exposes execution route and persistence health", () => {
    const service = createService();
    const health = service.getExecutionHealth();
    expect(health).toEqual(
      expect.objectContaining({
        route: expect.objectContaining({
          configured: expect.any(String),
          resolved: expect.any(String),
          ready: expect.any(Boolean),
        }),
        persistence: expect.objectContaining({
          enabled: expect.any(Boolean),
          backend: expect.any(String),
          postgresPrimary: expect.any(Boolean),
          mirrorJson: expect.any(Boolean),
        }),
      }),
    );
  });

  it("reports direct real route when configured", async () => {
    const previousRoute = process.env.REAL_EXECUTION_ROUTE;
    const previousHost = process.env.POLYMARKET_CLOB_HOST;
    process.env.REAL_EXECUTION_ROUTE = "direct";
    process.env.POLYMARKET_CLOB_HOST = "https://clob.polymarket.com";
    try {
      const service = createService();
      const health = service.getExecutionHealth();
      expect(health.route.configured).toBe("direct");
      expect(health.route.resolved).toBe("direct");
      expect(health.route.ready).toBe(true);
    } finally {
      if (previousRoute === undefined) {
        delete process.env.REAL_EXECUTION_ROUTE;
      } else {
        process.env.REAL_EXECUTION_ROUTE = previousRoute;
      }
      if (previousHost === undefined) {
        delete process.env.POLYMARKET_CLOB_HOST;
      } else {
        process.env.POLYMARKET_CLOB_HOST = previousHost;
      }
    }
  });

  it("reports gateway real route when endpoint is configured", async () => {
    const previousRoute = process.env.REAL_EXECUTION_ROUTE;
    const previousEndpoint = process.env.REAL_EXECUTION_HTTP_ENDPOINT;
    process.env.REAL_EXECUTION_ROUTE = "gateway";
    process.env.REAL_EXECUTION_HTTP_ENDPOINT = "https://example-execution-gateway.local/orders";
    try {
      const service = createService();
      const health = service.getExecutionHealth();
      expect(health.route.configured).toBe("gateway");
      expect(health.route.resolved).toBe("gateway");
      expect(health.route.ready).toBe(true);
    } finally {
      if (previousRoute === undefined) {
        delete process.env.REAL_EXECUTION_ROUTE;
      } else {
        process.env.REAL_EXECUTION_ROUTE = previousRoute;
      }
      if (previousEndpoint === undefined) {
        delete process.env.REAL_EXECUTION_HTTP_ENDPOINT;
      } else {
        process.env.REAL_EXECUTION_HTTP_ENDPOINT = previousEndpoint;
      }
    }
  });

  it("restores orders from persisted json store after service restart", async () => {
    const previousBackend = process.env.ORDER_STORE_BACKEND;
    const previousPath = process.env.ORDER_STORE_PATH;
    const previousPersistence = process.env.ORDER_PERSISTENCE;
    const previousPersistenceInTest = process.env.ORDER_PERSISTENCE_IN_TEST;
    const storePath = resolve(process.cwd(), "runtime/orders-store-recovery-test.json");
    process.env.ORDER_STORE_BACKEND = "json";
    process.env.ORDER_STORE_PATH = storePath;
    process.env.ORDER_PERSISTENCE = "on";
    process.env.ORDER_PERSISTENCE_IN_TEST = "true";

    try {
      if (existsSync(storePath)) {
        rmSync(storePath, { force: true });
      }
      const first = createService();
      const created = await first.create({
        marketId: "NYC_GT_85",
        side: "buy",
        quantity: 50,
        price: 0.2,
        orderType: "limit",
      });
      expect(created.status).toBe("open");

      const restarted = createService();
      const restored = restarted.list({ environment: "PAPER", limit: 500 });
      expect(restored.some((row) => row.id === created.id)).toBe(true);
      const restoredEvents = restarted.listEvents(created.id, 20);
      expect(restoredEvents.length).toBeGreaterThan(0);
    } finally {
      if (existsSync(storePath)) {
        rmSync(storePath, { force: true });
      }
      if (previousBackend === undefined) {
        delete process.env.ORDER_STORE_BACKEND;
      } else {
        process.env.ORDER_STORE_BACKEND = previousBackend;
      }
      if (previousPath === undefined) {
        delete process.env.ORDER_STORE_PATH;
      } else {
        process.env.ORDER_STORE_PATH = previousPath;
      }
      if (previousPersistence === undefined) {
        delete process.env.ORDER_PERSISTENCE;
      } else {
        process.env.ORDER_PERSISTENCE = previousPersistence;
      }
      if (previousPersistenceInTest === undefined) {
        delete process.env.ORDER_PERSISTENCE_IN_TEST;
      } else {
        process.env.ORDER_PERSISTENCE_IN_TEST = previousPersistenceInTest;
      }
    }
  });

  it("returns wallet snapshot with ledger and position metrics", async () => {
    const service = createService();
    await service.create({
      marketId: "NYC_GT_85",
      side: "buy",
      quantity: 100,
      price: 0.66,
      orderType: "market",
    });

    const snapshot = await service.getWalletSnapshot("PAPER");
    expect(snapshot.environment).toBe("PAPER");
    expect(snapshot.walletId).toMatch(/paper:\/\/wallet|0x/i);
    expect(snapshot.cash).toBeTypeOf("number");
    expect(snapshot.equity).toBeTypeOf("number");
    expect(snapshot.availableCash).toBeTypeOf("number");
    expect(snapshot.positions.length).toBeGreaterThanOrEqual(0);
    expect(snapshot.updatedAt).toBeTypeOf("string");
  });
});
