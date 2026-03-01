import { DEFAULT_DECIMALS, roundTo } from "./math";
import type {
  FillRecord,
  LedgerSnapshot,
  MarketSettlement,
  Position,
  SettlementRecord,
} from "./types";

function keyForPosition(marketId: string, outcomeId: string): string {
  return `${marketId}::${outcomeId}`;
}

function getOrCreatePosition(
  positions: Record<string, Position>,
  marketId: string,
  outcomeId: string,
): Position {
  const key = keyForPosition(marketId, outcomeId);
  const existing = positions[key];
  if (existing) {
    return existing;
  }

  const created: Position = {
    marketId,
    outcomeId,
    quantity: 0,
    averageCost: 0,
    realizedPnl: 0,
    unsettledCost: 0,
  };
  positions[key] = created;
  return created;
}

function removeIfFlat(positions: Record<string, Position>, marketId: string, outcomeId: string): void {
  const key = keyForPosition(marketId, outcomeId);
  const position = positions[key];
  if (!position) {
    return;
  }
  if (position.quantity !== 0) {
    return;
  }
  delete positions[key];
}

export class PredictionLedger {
  private readonly state: LedgerSnapshot;

  constructor(initialCash: number) {
    this.state = {
      cash: roundTo(initialCash, DEFAULT_DECIMALS.cashDp),
      reservedCash: 0,
      realizedPnl: 0,
      settledPnl: 0,
      positions: {},
    };
  }

  syncCash(cash: number): void {
    this.state.cash = roundTo(cash, DEFAULT_DECIMALS.cashDp);
  }

  snapshot(): LedgerSnapshot {
    return JSON.parse(JSON.stringify(this.state)) as LedgerSnapshot;
  }

  hydrate(snapshot: LedgerSnapshot): void {
    this.state.cash = roundTo(snapshot.cash, DEFAULT_DECIMALS.cashDp);
    this.state.reservedCash = roundTo(snapshot.reservedCash, DEFAULT_DECIMALS.cashDp);
    this.state.realizedPnl = roundTo(snapshot.realizedPnl, DEFAULT_DECIMALS.cashDp);
    this.state.settledPnl = roundTo(snapshot.settledPnl, DEFAULT_DECIMALS.cashDp);
    this.state.positions = JSON.parse(JSON.stringify(snapshot.positions)) as LedgerSnapshot["positions"];
  }

  marketExposure(marketId: string): number {
    return roundTo(
      Object.values(this.state.positions)
        .filter((position) => position.marketId === marketId)
        .reduce((sum, position) => sum + Math.abs(position.quantity * position.averageCost), 0),
      DEFAULT_DECIMALS.cashDp,
    );
  }

  applyFill(fill: FillRecord): void {
    const position = getOrCreatePosition(this.state.positions, fill.marketId, fill.outcomeId);
    if (fill.side === "BUY") {
      const prevCost = position.averageCost * position.quantity;
      const nextQty = roundTo(position.quantity + fill.quantity, DEFAULT_DECIMALS.qtyDp);
      const nextCost = prevCost + fill.notional;
      position.quantity = nextQty;
      position.averageCost = nextQty > 0 ? roundTo(nextCost / nextQty, DEFAULT_DECIMALS.priceDp) : 0;
      position.unsettledCost = roundTo(position.unsettledCost + fill.notional, DEFAULT_DECIMALS.cashDp);
      this.state.cash = roundTo(this.state.cash - fill.notional - fill.fee, DEFAULT_DECIMALS.cashDp);
      return;
    }

    const closable = Math.min(position.quantity, fill.quantity);
    const realized = roundTo((fill.price - position.averageCost) * closable, DEFAULT_DECIMALS.cashDp);
    position.quantity = roundTo(position.quantity - closable, DEFAULT_DECIMALS.qtyDp);
    position.realizedPnl = roundTo(position.realizedPnl + realized, DEFAULT_DECIMALS.cashDp);
    position.unsettledCost = roundTo(
      Math.max(0, position.unsettledCost - position.averageCost * closable),
      DEFAULT_DECIMALS.cashDp,
    );
    if (position.quantity === 0) {
      position.averageCost = 0;
      position.unsettledCost = 0;
    }
    this.state.realizedPnl = roundTo(this.state.realizedPnl + realized, DEFAULT_DECIMALS.cashDp);
    this.state.cash = roundTo(this.state.cash + fill.notional - fill.fee, DEFAULT_DECIMALS.cashDp);
    removeIfFlat(this.state.positions, fill.marketId, fill.outcomeId);
  }

  applySettlement(input: MarketSettlement): SettlementRecord {
    let cashDelta = 0;
    let settledPnlDelta = 0;
    const related = Object.values(this.state.positions).filter((position) => position.marketId === input.marketId);

    for (const position of related) {
      const payoutPerUnit =
        input.reason === "CANCELED"
          ? position.averageCost
          : input.winningOutcomeId && input.winningOutcomeId === position.outcomeId
            ? 1
            : 0;
      const payout = roundTo(position.quantity * payoutPerUnit, DEFAULT_DECIMALS.cashDp);
      const pnl = roundTo(payout - position.unsettledCost, DEFAULT_DECIMALS.cashDp);

      cashDelta = roundTo(cashDelta + payout, DEFAULT_DECIMALS.cashDp);
      settledPnlDelta = roundTo(settledPnlDelta + pnl, DEFAULT_DECIMALS.cashDp);
      delete this.state.positions[keyForPosition(position.marketId, position.outcomeId)];
    }

    this.state.cash = roundTo(this.state.cash + cashDelta, DEFAULT_DECIMALS.cashDp);
    this.state.settledPnl = roundTo(this.state.settledPnl + settledPnlDelta, DEFAULT_DECIMALS.cashDp);

    return {
      marketId: input.marketId,
      ts: input.ts,
      reason: input.reason,
      winningOutcomeId: input.winningOutcomeId,
      observedTemperatureC: input.observedTemperatureC,
      source: input.source,
      cashDelta,
      settledPnlDelta,
    };
  }
}
