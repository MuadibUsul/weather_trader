import { Candle } from "../strategy/Strategy";

export class DataFeed {
  private readonly candles: Candle[];
  private cursor = 0;

  constructor(candles: Candle[]) {
    this.candles = candles
      .map((c, i) => ({ ...c, __i: i }))
      .sort((a, b) => {
        if (a.ts !== b.ts) return a.ts - b.ts;
        if (a.symbol !== b.symbol) return a.symbol.localeCompare(b.symbol);
        return a.__i - b.__i;
      })
      .map(({ __i, ...c }) => c);
  }

  next(): Candle | null {
    if (this.cursor >= this.candles.length) {
      return null;
    }
    const item = this.candles[this.cursor];
    this.cursor += 1;
    return item;
  }

  reset() {
    this.cursor = 0;
  }

  size() {
    return this.candles.length;
  }
}
