import { DEFAULT_DECIMALS, roundTo } from "./math";
import type { FillRecord, MarketQuote, OrderRecord } from "./types";

export type FillModelContext = {
  feeRate: number;
  slippageBps: number;
  chainCostPerFill: number;
  fixedFee: number;
  networkCost: number;
  maxFillRatioPerTick: number;
  spreadSlippageK: number;
  impactBps: number;
};

export type MatchResult = {
  fills: FillRecord[];
  filledQuantity: number;
  remainingQuantity: number;
};

function buildFill(
  order: OrderRecord,
  market: MarketQuote,
  qty: number,
  bookPrice: number,
  spreadAdj: number,
  impactAdj: number,
  context: FillModelContext,
  fillSeq: number,
): FillRecord {
  const sign = order.side === "BUY" ? 1 : -1;
  const baseImpact = Math.abs(bookPrice) * (context.slippageBps / 10_000);
  const finalPrice = roundTo(bookPrice + sign * (spreadAdj + impactAdj + baseImpact), DEFAULT_DECIMALS.priceDp);
  const grossAmount = roundTo(qty * finalPrice, DEFAULT_DECIMALS.cashDp);
  const tradingFee = roundTo(grossAmount * context.feeRate, DEFAULT_DECIMALS.cashDp);
  const fixedFee = roundTo(context.fixedFee, DEFAULT_DECIMALS.cashDp);
  const networkCost = roundTo(context.networkCost + context.chainCostPerFill, DEFAULT_DECIMALS.cashDp);
  const fee = roundTo(tradingFee + fixedFee + networkCost, DEFAULT_DECIMALS.cashDp);
  const netAmount = order.side === "BUY" ? roundTo(-(grossAmount + fee), DEFAULT_DECIMALS.cashDp) : roundTo(grossAmount - fee, DEFAULT_DECIMALS.cashDp);

  return {
    id: `${order.id}-F${fillSeq}`,
    orderId: order.id,
    mode: order.mode,
    marketId: order.marketId,
    outcomeId: order.outcomeId,
    side: order.side,
    price: finalPrice,
    quantity: qty,
    notional: grossAmount,
    fee,
    ts: market.ts,
    bookPrice: roundTo(bookPrice, DEFAULT_DECIMALS.priceDp),
    spreadAdj: roundTo(spreadAdj, DEFAULT_DECIMALS.priceDp),
    impactAdj: roundTo(impactAdj + baseImpact, DEFAULT_DECIMALS.priceDp),
    latencyMs: Math.max(0, market.ts - order.createdAtMs),
    grossAmount,
    netAmount,
    feeBreakdown: {
      tradingFee,
      fixedFee,
      networkCost,
      totalFee: fee,
    },
  };
}

export interface FillModel {
  match(order: OrderRecord, quote: MarketQuote, context: FillModelContext): MatchResult;
}

type RandomSource = () => number;

function createSeededRandom(seed: number): RandomSource {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export class MidPriceFillModel implements FillModel {
  private seq = 1;

  match(order: OrderRecord, quote: MarketQuote, context: FillModelContext): MatchResult {
    const outcome = quote.outcomes[order.outcomeId];
    if (!outcome) {
      return { fills: [], filledQuantity: 0, remainingQuantity: order.remainingQuantity };
    }

    const executionRef = order.side === "BUY" ? outcome.bestAsk : outcome.bestBid;
    const passLimit =
      order.type === "MARKET" ||
      order.limitPrice === null ||
      (order.side === "BUY" ? order.limitPrice >= executionRef : order.limitPrice <= executionRef);
    if (!passLimit) {
      return { fills: [], filledQuantity: 0, remainingQuantity: order.remainingQuantity };
    }

    const available = order.side === "BUY" ? outcome.askSize : outcome.bidSize;
    const capped = Math.max(0, available * context.maxFillRatioPerTick);
    const fillQty = roundTo(Math.min(order.remainingQuantity, capped), DEFAULT_DECIMALS.qtyDp);
    if (fillQty <= 0) {
      return { fills: [], filledQuantity: 0, remainingQuantity: order.remainingQuantity };
    }

    const base = outcome.midpoint > 0 ? outcome.midpoint : (outcome.bestAsk + outcome.bestBid) / 2;
    const spread = Math.max(0, outcome.bestAsk - outcome.bestBid);
    const spreadAdj = spread * context.spreadSlippageK;
    const visibleLiquidity = Math.max(1, available);
    const impactAdj = base * (context.impactBps / 10_000) * (fillQty / visibleLiquidity);
    const fill = buildFill(order, quote, fillQty, base, spreadAdj, impactAdj, context, this.seq++);
    return {
      fills: [fill],
      filledQuantity: fillQty,
      remainingQuantity: roundTo(order.remainingQuantity - fillQty, DEFAULT_DECIMALS.qtyDp),
    };
  }
}

export class DepthAwareFillModel implements FillModel {
  private seq = 1;

  match(order: OrderRecord, quote: MarketQuote, context: FillModelContext): MatchResult {
    const outcome = quote.outcomes[order.outcomeId];
    if (!outcome) {
      return { fills: [], filledQuantity: 0, remainingQuantity: order.remainingQuantity };
    }
    const best = order.side === "BUY" ? outcome.bestAsk : outcome.bestBid;
    const passLimit =
      order.type === "MARKET" ||
      order.limitPrice === null ||
      (order.side === "BUY" ? order.limitPrice >= best : order.limitPrice <= best);
    if (!passLimit) {
      return { fills: [], filledQuantity: 0, remainingQuantity: order.remainingQuantity };
    }

    const level1Size = order.side === "BUY" ? outcome.askSize : outcome.bidSize;
    const cappedLevel1 = Math.max(0, level1Size * context.maxFillRatioPerTick);
    const level1Qty = roundTo(Math.min(order.remainingQuantity, cappedLevel1), DEFAULT_DECIMALS.qtyDp);
    const fills: FillRecord[] = [];

    if (level1Qty > 0) {
      const spread = Math.max(0, outcome.bestAsk - outcome.bestBid);
      const spreadAdj = spread * context.spreadSlippageK;
      const visibleLiquidity = Math.max(1, level1Size);
      const impactAdj = best * (context.impactBps / 10_000) * (level1Qty / visibleLiquidity);
      fills.push(
        buildFill(
          order,
          quote,
          level1Qty,
          best,
          spreadAdj,
          impactAdj,
          context,
          this.seq++,
        ),
      );
    }

    let filledQuantity = level1Qty;
    let remaining = roundTo(order.remainingQuantity - level1Qty, DEFAULT_DECIMALS.qtyDp);
    if (remaining > 0) {
      const worsePrice = order.side === "BUY" ? best * 1.01 : best * 0.99;
      const level2Liquidity = Math.max(1, level1Size * 0.5);
      const level2Qty = roundTo(
        Math.min(remaining, level2Liquidity * context.maxFillRatioPerTick),
        DEFAULT_DECIMALS.qtyDp,
      );
      if (level2Qty > 0) {
        const spread = Math.max(0, outcome.bestAsk - outcome.bestBid);
        const spreadAdj = spread * context.spreadSlippageK;
        const impactAdj = worsePrice * (context.impactBps / 10_000) * (level2Qty / level2Liquidity);
        fills.push(buildFill(order, quote, level2Qty, worsePrice, spreadAdj, impactAdj, context, this.seq++));
        filledQuantity = roundTo(filledQuantity + level2Qty, DEFAULT_DECIMALS.qtyDp);
        remaining = roundTo(remaining - level2Qty, DEFAULT_DECIMALS.qtyDp);
      }
    }

    return {
      fills,
      filledQuantity,
      remainingQuantity: remaining,
    };
  }
}

export class StochasticImpactFillModel implements FillModel {
  private seq = 1;
  private readonly random: RandomSource;

  constructor(seed = 42, private readonly noiseBps = 6) {
    this.random = createSeededRandom(seed);
  }

  match(order: OrderRecord, quote: MarketQuote, context: FillModelContext): MatchResult {
    const outcome = quote.outcomes[order.outcomeId];
    if (!outcome) {
      return { fills: [], filledQuantity: 0, remainingQuantity: order.remainingQuantity };
    }
    const best = order.side === "BUY" ? outcome.bestAsk : outcome.bestBid;
    const passLimit =
      order.type === "MARKET" ||
      order.limitPrice === null ||
      (order.side === "BUY" ? order.limitPrice >= best : order.limitPrice <= best);
    if (!passLimit) {
      return { fills: [], filledQuantity: 0, remainingQuantity: order.remainingQuantity };
    }

    const level1Size = order.side === "BUY" ? outcome.askSize : outcome.bidSize;
    const cappedLevel1 = Math.max(0, level1Size * context.maxFillRatioPerTick);
    const level1Qty = roundTo(Math.min(order.remainingQuantity, cappedLevel1), DEFAULT_DECIMALS.qtyDp);
    const fills: FillRecord[] = [];

    if (level1Qty > 0) {
      const spread = Math.max(0, outcome.bestAsk - outcome.bestBid);
      const spreadAdj = spread * context.spreadSlippageK;
      const visibleLiquidity = Math.max(1, level1Size);
      const baseImpactAdj = best * (context.impactBps / 10_000) * (level1Qty / visibleLiquidity);
      const noiseAdj = best * this.sampleNoise();
      fills.push(buildFill(order, quote, level1Qty, best, spreadAdj, baseImpactAdj + noiseAdj, context, this.seq++));
    }

    let filledQuantity = level1Qty;
    let remaining = roundTo(order.remainingQuantity - level1Qty, DEFAULT_DECIMALS.qtyDp);
    if (remaining > 0) {
      const worsePrice = order.side === "BUY" ? best * 1.01 : best * 0.99;
      const level2Liquidity = Math.max(1, level1Size * 0.5);
      const level2Qty = roundTo(
        Math.min(remaining, level2Liquidity * context.maxFillRatioPerTick),
        DEFAULT_DECIMALS.qtyDp,
      );
      if (level2Qty > 0) {
        const spread = Math.max(0, outcome.bestAsk - outcome.bestBid);
        const spreadAdj = spread * context.spreadSlippageK;
        const baseImpactAdj = worsePrice * (context.impactBps / 10_000) * (level2Qty / level2Liquidity);
        const noiseAdj = worsePrice * this.sampleNoise();
        fills.push(
          buildFill(
            order,
            quote,
            level2Qty,
            worsePrice,
            spreadAdj,
            baseImpactAdj + noiseAdj,
            context,
            this.seq++,
          ),
        );
        filledQuantity = roundTo(filledQuantity + level2Qty, DEFAULT_DECIMALS.qtyDp);
        remaining = roundTo(remaining - level2Qty, DEFAULT_DECIMALS.qtyDp);
      }
    }

    return {
      fills,
      filledQuantity,
      remainingQuantity: remaining,
    };
  }

  private sampleNoise(): number {
    const centered = this.random() * 2 - 1;
    return centered * (this.noiseBps / 10_000);
  }
}
