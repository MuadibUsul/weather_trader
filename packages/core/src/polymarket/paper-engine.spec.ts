import { describe, expect, it } from "vitest";
import { createMockWeatherScenario } from "./mock-data";
import { PaperExecutionEngine } from "./paper-engine";
import { runPaperResearch } from "./paper-runner";
import { RealExecutionEngine, type RealOrderGateway } from "./real-engine";

const riskLimits = {
  maxNotionalPerOrder: 1_000_000,
  maxPositionPerOutcome: 1_000_000,
  maxExposurePerMarket: 1_000_000,
  maxOpenOrders: 1000,
  maxDailyLoss: 1_000_000,
};

describe("PaperExecutionEngine", () => {
  it("supports partial fill + IOC cancel", async () => {
    const engine = new PaperExecutionEngine({
      initialCash: 10000,
      feeRate: 0.001,
      slippageBps: 0,
      latencyMs: 0,
      riskLimits,
      matchingModel: "depth",
    });

    const quote = {
      marketId: "M1",
      ts: Date.now(),
      outcomes: {
        YES: {
          outcomeId: "YES",
          bestBid: 0.49,
          bestAsk: 0.5,
          bidSize: 20,
          askSize: 25,
          midpoint: 0.495,
        },
      },
    };

    const submitted = await engine.submit(
      {
        marketId: "M1",
        outcomeId: "YES",
        side: "BUY",
        type: "LIMIT",
        quantity: 80,
        limitPrice: 0.5,
        tif: "IOC",
        createdAtMs: quote.ts,
      },
      quote,
    );
    await engine.onTime(quote.ts);
    await engine.onMarketDataTick(quote);
    const result = engine.getSnapshot().orders.find((item) => item.id === submitted.order.id)!;

    expect(result.status).toBe("CANCELED");
    expect(result.filledQuantity).toBeGreaterThan(0);
    expect(result.remainingQuantity).toBeGreaterThan(0);
  });

  it("applies settlement and crystallizes pnl", async () => {
    const engine = new PaperExecutionEngine({
      initialCash: 1000,
      feeRate: 0,
      slippageBps: 0,
      latencyMs: 0,
      riskLimits,
      matchingModel: "mid",
    });

    const quote = {
      marketId: "M2",
      ts: Date.now(),
      outcomes: {
        YES: {
          outcomeId: "YES",
          bestBid: 0.39,
          bestAsk: 0.41,
          bidSize: 500,
          askSize: 500,
          midpoint: 0.4,
        },
      },
    };

    await engine.submit(
      {
        marketId: "M2",
        outcomeId: "YES",
        side: "BUY",
        type: "LIMIT",
        quantity: 100,
        limitPrice: 0.41,
        tif: "IOC",
        createdAtMs: quote.ts,
      },
      quote,
    );
    await engine.onTime(quote.ts);
    await engine.onMarketDataTick(quote);

    const settled = await engine.settle({
      marketId: "M2",
      ts: quote.ts + 10_000,
      reason: "RESOLVED",
      winningOutcomeId: "YES",
    });
    expect(settled.settlement.cashDelta).toBe(100);
    expect(settled.ledger.settledPnl).toBeGreaterThan(0);
  });

  it("keeps deterministic fills between paper and real when gateway accepts", async () => {
    class PassGateway implements RealOrderGateway {
      async placeOrder() {
        return { externalOrderId: "EXT-1", accepted: true };
      }
    }
    const paper = new PaperExecutionEngine({
      initialCash: 10000,
      feeRate: 0.001,
      slippageBps: 5,
      latencyMs: 0,
      riskLimits,
      matchingModel: "depth",
    });
    const real = new RealExecutionEngine({
      initialCash: 10000,
      feeRate: 0.001,
      slippageBps: 5,
      latencyMs: 0,
      riskLimits,
      gateway: new PassGateway(),
      matchingModel: "depth",
    });
    const quote = {
      marketId: "M3",
      ts: Date.now(),
      outcomes: {
        YES: {
          outcomeId: "YES",
          bestBid: 0.55,
          bestAsk: 0.57,
          bidSize: 100,
          askSize: 100,
          midpoint: 0.56,
        },
      },
    };
    const req = {
      marketId: "M3",
      outcomeId: "YES",
      side: "BUY" as const,
      type: "LIMIT" as const,
      quantity: 90,
      limitPrice: 0.57,
      tif: "IOC" as const,
      createdAtMs: quote.ts,
    };
    await Promise.all([paper.submit(req, quote), real.submit(req, quote)]);
    await Promise.all([paper.onTime(quote.ts), real.onTime(quote.ts)]);
    await Promise.all([paper.onMarketDataTick(quote), real.onMarketDataTick(quote)]);
    const paperSnapshot = paper.getSnapshot();
    const realSnapshot = real.getSnapshot();
    const normalize = (fills: typeof paperSnapshot.fills) =>
      fills.map((fill) => ({
        price: fill.price,
        quantity: fill.quantity,
        notional: fill.notional,
        fee: fill.fee,
      }));
    expect(normalize(paperSnapshot.fills)).toEqual(normalize(realSnapshot.fills));
    expect(paperSnapshot.ledger.cash).toBe(realSnapshot.ledger.cash);
  });

  it("produces auditable research report from paper loop", async () => {
    const scenario = createMockWeatherScenario();
    const output = await runPaperResearch({
      ...scenario,
      execution: {
        initialCash: 10000,
        feeRate: 0.001,
        slippageBps: 5,
        riskLimits,
        matchingModel: "depth",
      },
      strategy: {
        edgeThreshold: 0.03,
        minConfidence: 0.5,
        orderNotional: 150,
        maxOrdersPerTick: 2,
      },
    });

    expect(output.report.summary.totalOrders).toBeGreaterThan(0);
    expect(output.report.forecastMetrics.calibration.length).toBe(10);
    expect(output.report.robustness.reconciliation.diff).toBeCloseTo(0, 4);
    expect(output.auditJsonl.includes("OrderEnteredBook")).toBe(true);
  });
});
