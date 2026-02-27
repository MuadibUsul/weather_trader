import { SignalSide, TradeSignal } from "../strategy/Strategy";

export type PortfolioState = {
  cash: number;
  positions: Map<string, number>;
};

export type ExecutedTrade = {
  id: string;
  ts: number;
  symbol: string;
  side: SignalSide;
  quantity: number;
  requestedPrice: number;
  executedPrice: number;
  notional: number;
  fee: number;
  cashAfter: number;
  positionAfter: number;
  tag?: string;
};

export type ExecutionConfig = {
  feeRate: number;
  slippageBps: number;
};

export class ExecutionSimulator {
  private seq = 1;

  constructor(private readonly config: ExecutionConfig) {}

  execute(signal: TradeSignal, markPrice: number, portfolio: PortfolioState): ExecutedTrade {
    const signedQty = signal.side === "buy" ? signal.quantity : -signal.quantity;
    const slip = 1 + (this.config.slippageBps / 10_000) * (signal.side === "buy" ? 1 : -1);
    const executedPrice = markPrice * slip;
    const notional = Math.abs(signal.quantity * executedPrice);
    const fee = notional * this.config.feeRate;

    portfolio.cash -= signedQty * executedPrice + fee;

    const nextPosition = (portfolio.positions.get(signal.symbol) ?? 0) + signedQty;
    portfolio.positions.set(signal.symbol, nextPosition);

    return {
      id: `T${this.seq++}`,
      ts: signal.ts,
      symbol: signal.symbol,
      side: signal.side,
      quantity: signal.quantity,
      requestedPrice: markPrice,
      executedPrice,
      notional,
      fee,
      cashAfter: portfolio.cash,
      positionAfter: nextPosition,
      tag: signal.tag,
    };
  }
}
