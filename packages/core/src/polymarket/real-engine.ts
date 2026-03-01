import { DepthAwareFillModel, MidPriceFillModel, type FillModel } from "./matching";
import { SimulatedExecutionEngine } from "./simulated-engine";
import type { ExecutionResult, MarketQuote, OrderRequest, RiskLimits } from "./types";

export interface RealOrderGateway {
  placeOrder(
    request: OrderRequest,
  ): Promise<{ externalOrderId: string; accepted: boolean; reason?: string }>;
}

export type RealEngineConfig = {
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
  gateway: RealOrderGateway;
  matchingModel?: "mid" | "depth";
  fillModel?: FillModel;
  failureThreshold?: number;
};

export class RealExecutionEngine extends SimulatedExecutionEngine {
  private readonly gateway: RealOrderGateway;
  private readonly failureThreshold: number;
  private failureCount = 0;
  private circuitOpen = false;
  private killSwitch = false;

  constructor(config: RealEngineConfig) {
    const fillModel =
      config.fillModel ??
      (config.matchingModel === "mid" ? new MidPriceFillModel() : new DepthAwareFillModel());
    super({
      mode: "REAL",
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
    this.gateway = config.gateway;
    this.failureThreshold = Math.max(1, config.failureThreshold ?? 3);
  }

  setKillSwitch(enabled: boolean): void {
    this.killSwitch = enabled;
  }

  resetCircuitBreaker(): void {
    this.failureCount = 0;
    this.circuitOpen = false;
  }

  getGatewayState(): { killSwitch: boolean; circuitOpen: boolean; failureCount: number } {
    return {
      killSwitch: this.killSwitch,
      circuitOpen: this.circuitOpen,
      failureCount: this.failureCount,
    };
  }

  override async submit(request: OrderRequest, quote: MarketQuote): Promise<ExecutionResult> {
    if (this.killSwitch) {
      throw new Error("kill_switch_enabled");
    }
    if (this.circuitOpen) {
      throw new Error("circuit_breaker_open");
    }

    try {
      const ack = await this.gateway.placeOrder(request);
      if (!ack.accepted) {
        throw new Error(ack.reason ?? "real_gateway_rejected");
      }
      const result = await super.submit(
        {
          ...request,
          id: request.id,
        },
        quote,
      );
      this.failureCount = 0;
      return result;
    } catch (error) {
      this.failureCount += 1;
      this.updateCircuitState();
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("real_gateway_failed");
    }
  }

  private updateCircuitState(): void {
    if (this.failureCount >= this.failureThreshold) {
      this.circuitOpen = true;
    }
  }
}
