import { DEFAULT_DECIMALS, roundTo } from "./math";
import type { RiskCheckInput, RiskDecision, RiskLimits } from "./types";

export class PredictionRiskEngine {
  constructor(private readonly limits: RiskLimits) {}

  evaluate(input: RiskCheckInput): RiskDecision {
    const request = input.request;
    const quote = input.quote.outcomes[request.outcomeId];
    if (!quote) {
      return { ok: false, reason: "outcome_quote_not_found" };
    }

    const quantity = roundTo(request.quantity, DEFAULT_DECIMALS.qtyDp);
    if (quantity <= 0) {
      return { ok: false, reason: "invalid_quantity" };
    }

    const referencePrice = request.side === "BUY" ? quote.bestAsk : quote.bestBid;
    const limitPrice = request.type === "MARKET" ? referencePrice : request.limitPrice ?? referencePrice;
    if (!Number.isFinite(limitPrice) || limitPrice <= 0 || limitPrice > 1) {
      return { ok: false, reason: "invalid_limit_price" };
    }

    const notional = roundTo(limitPrice * quantity, DEFAULT_DECIMALS.cashDp);
    if (notional > this.limits.maxNotionalPerOrder) {
      return { ok: false, reason: "max_notional_exceeded" };
    }

    if (input.openOrders >= this.limits.maxOpenOrders) {
      return { ok: false, reason: "max_open_orders_exceeded" };
    }

    if (request.side === "BUY" && notional > input.ledger.cash) {
      return { ok: false, reason: "insufficient_cash" };
    }

    const positionKey = `${request.marketId}::${request.outcomeId}`;
    const currentPosition = input.ledger.positions[positionKey]?.quantity ?? 0;
    const nextPosition = request.side === "BUY" ? currentPosition + quantity : currentPosition - quantity;
    if (request.side === "SELL" && quantity > currentPosition) {
      return { ok: false, reason: "insufficient_position" };
    }
    if (Math.abs(nextPosition) > this.limits.maxPositionPerOutcome) {
      return { ok: false, reason: "max_position_per_outcome_exceeded" };
    }

    if (input.marketExposure + notional > this.limits.maxExposurePerMarket) {
      return { ok: false, reason: "max_market_exposure_exceeded" };
    }

    if (input.realizedLossToday > this.limits.maxDailyLoss) {
      return { ok: false, reason: "max_daily_loss_exceeded" };
    }

    return { ok: true };
  }
}
