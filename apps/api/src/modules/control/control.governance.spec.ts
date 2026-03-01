import { describe, expect, it } from "vitest";
import { ControlStoreService } from "./control.store";
import { ControlStrategyGovernanceService } from "./control.strategy-governance.service";

describe("ControlStrategyGovernanceService", () => {
  it("transitions request -> approve -> real_small", () => {
    const store = new ControlStoreService();
    const service = new ControlStrategyGovernanceService(store);
    const strategyId = store.getDefaultStrategyId();

    store.patchStrategy(strategyId, { status: "eligible" });
    const requested = service.requestReal(strategyId, { reason: "ready" }, "tester");
    expect(requested.status).toBe("real_requested");

    const approved = service.approveReal(
      strategyId,
      {
        riskLimits: {
          maxDailyLoss: 1000,
          maxPositionSize: 5000,
          maxOpenPositions: 3,
          maxSlippageBps: 80,
        },
        initialAllocationPct: 10,
      },
      "risk",
    );
    expect(approved.status).toBe("real_small");
  });

  it("blocks real auto trading when status not approved", () => {
    const store = new ControlStoreService();
    const service = new ControlStrategyGovernanceService(store);
    const strategyId = store.getDefaultStrategyId();
    store.patchStrategy(strategyId, { status: "paper_testing" });
    expect(() => service.assertRealAutoTradingAllowed(strategyId)).toThrowError("strategy_real_not_approved");
  });
});
