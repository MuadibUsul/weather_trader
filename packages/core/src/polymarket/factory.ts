import { ModeManager } from "./mode-manager";
import { PaperExecutionEngine } from "./paper-engine";
import { RealExecutionEngine, type RealOrderGateway } from "./real-engine";
import type { ExecutionFactoryConfig, ExecutionMode } from "./types";

export function createModeManager(input: {
  config: ExecutionFactoryConfig;
  initialCash: Record<ExecutionMode, number>;
  gateway: RealOrderGateway;
  initialMode?: ExecutionMode;
}) {
  const paper = new PaperExecutionEngine({
    initialCash: input.initialCash.PAPER,
    feeRate: input.config.feeRate,
    slippageBps: input.config.slippageBps,
    chainCostPerFill: input.config.chainCostPerFill,
    fixedFee: input.config.fixedFee ?? 0,
    networkCost: input.config.networkCost ?? 0,
    latencyMs: input.config.latencyMs ?? 500,
    maxFillRatioPerTick: input.config.maxFillRatioPerTick ?? 0.2,
    spreadSlippageK: input.config.spreadSlippageK ?? 0.25,
    impactBps: input.config.impactBps ?? 10,
    allowTradeAfterClose: input.config.allowTradeAfterClose ?? false,
    riskLimits: input.config.risk,
  });
  const real = new RealExecutionEngine({
    initialCash: input.initialCash.REAL,
    feeRate: input.config.feeRate,
    slippageBps: input.config.slippageBps,
    chainCostPerFill: input.config.chainCostPerFill,
    fixedFee: input.config.fixedFee ?? 0,
    networkCost: input.config.networkCost ?? 0,
    latencyMs: input.config.latencyMs ?? 500,
    maxFillRatioPerTick: input.config.maxFillRatioPerTick ?? 0.2,
    spreadSlippageK: input.config.spreadSlippageK ?? 0.25,
    impactBps: input.config.impactBps ?? 10,
    allowTradeAfterClose: input.config.allowTradeAfterClose ?? false,
    riskLimits: input.config.risk,
    gateway: input.gateway,
  });

  return new ModeManager(
    {
      PAPER: paper,
      REAL: real,
    },
    input.initialMode ?? "PAPER",
  );
}
