import { TradeSignal } from "../strategy/Strategy";

export type RiskConfig = {
  maxDrawdownPct: number;
  maxPositionPerSymbol: number;
  maxNotionalPerTrade: number;
};

export type RiskCheck = {
  ok: boolean;
  reason?: string;
};

export type RiskState = {
  equity: number;
  positionQty: number;
  markPrice: number;
};

export class RiskEngine {
  private peakEquity: number;

  constructor(
    private readonly config: RiskConfig,
    initialEquity: number,
  ) {
    this.peakEquity = initialEquity;
  }

  syncEquity(equity: number) {
    this.peakEquity = Math.max(this.peakEquity, equity);
  }

  evaluate(signal: TradeSignal, state: RiskState): RiskCheck {
    const drawdownPct = this.peakEquity <= 0 ? 0 : ((this.peakEquity - state.equity) / this.peakEquity) * 100;
    if (drawdownPct > this.config.maxDrawdownPct) {
      return { ok: false, reason: `max_drawdown_exceeded:${drawdownPct.toFixed(2)}%` };
    }

    const nextPosition = state.positionQty + (signal.side === "buy" ? signal.quantity : -signal.quantity);
    if (Math.abs(nextPosition) > this.config.maxPositionPerSymbol) {
      return { ok: false, reason: "max_position_exceeded" };
    }

    const notional = Math.abs(signal.quantity * state.markPrice);
    if (notional > this.config.maxNotionalPerTrade) {
      return { ok: false, reason: "max_notional_exceeded" };
    }

    return { ok: true };
  }
}
