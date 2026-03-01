import { DepthAwareFillModel, MidPriceFillModel, StochasticImpactFillModel, type FillModel } from "./matching";
import { SimulatedExecutionEngine } from "./simulated-engine";
import type { RiskLimits } from "./types";

export type PaperEngineConfig = {
  initialCash: number;
  feeRate: number;
  slippageBps: number;
  chainCostPerFill?: number;
  fixedFee?: number;
  networkCost?: number;
  latencyMs?: number;
  maxFillRatioPerTick?: number;
  spreadSlippageK?: number;
  impactBps?: number;
  allowTradeAfterClose?: boolean;
  riskLimits: RiskLimits;
  matchingModel?: "mid" | "depth" | "deterministic_l2" | "stochastic_impact";
  fillModel?: FillModel;
  stochasticSeed?: number;
  stochasticNoiseBps?: number;
};

export class PaperExecutionEngine extends SimulatedExecutionEngine {
  constructor(config: PaperEngineConfig) {
    const fillModel = config.fillModel ?? PaperExecutionEngine.buildDefaultFillModel(config);
    super({
      mode: "PAPER",
      initialCash: config.initialCash,
      feeRate: config.feeRate,
      slippageBps: config.slippageBps,
      chainCostPerFill: config.chainCostPerFill ?? 0,
      fixedFee: config.fixedFee ?? 0,
      networkCost: config.networkCost ?? 0,
      latencyMs: config.latencyMs ?? 500,
      maxFillRatioPerTick: config.maxFillRatioPerTick ?? 0.2,
      spreadSlippageK: config.spreadSlippageK ?? 0.25,
      impactBps: config.impactBps ?? 10,
      allowTradeAfterClose: config.allowTradeAfterClose ?? false,
      riskLimits: config.riskLimits,
      fillModel,
    });
  }

  private static buildDefaultFillModel(config: PaperEngineConfig): FillModel {
    if (config.matchingModel === "mid") {
      return new MidPriceFillModel();
    }
    if (config.matchingModel === "stochastic_impact") {
      return new StochasticImpactFillModel(
        config.stochasticSeed ?? 42,
        config.stochasticNoiseBps ?? 6,
      );
    }
    return new DepthAwareFillModel();
  }
}
