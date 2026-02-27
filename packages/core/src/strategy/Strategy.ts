export type Candle = {
  ts: number;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type SignalSide = "buy" | "sell";

export type TradeSignal = {
  ts: number;
  symbol: string;
  side: SignalSide;
  quantity: number;
  tag?: string;
};

export type PositionSnapshot = {
  quantity: number;
  markPrice: number;
};

export type StrategyContext = {
  index: number;
  candle: Candle;
  equity: number;
  historyBySymbol: ReadonlyMap<string, Candle[]>;
  positions: ReadonlyMap<string, PositionSnapshot>;
};

export interface Strategy {
  readonly name: string;
  onCandle(candle: Candle, context: StrategyContext): TradeSignal[];
}
