import { EventStore } from "./event-store";
import { DEFAULT_DECIMALS, roundTo } from "./math";
import type { FillModel } from "./matching";
import { PredictionLedger } from "./ledger";
import { PredictionRiskEngine } from "./risk";
import type {
  CancelResult,
  ExecutionEngine,
  ExecutionEvent,
  ExecutionMode,
  ExecutionResult,
  ExecutionSnapshot,
  MarketQuote,
  MarketSettlement,
  OrderRecord,
  OrderRequest,
  RiskLimits,
  SettlementResult,
} from "./types";

type SimulationConfig = {
  mode: ExecutionMode;
  initialCash: number;
  feeRate: number;
  slippageBps: number;
  chainCostPerFill: number;
  fixedFee?: number;
  networkCost?: number;
  latencyMs?: number;
  maxFillRatioPerTick?: number;
  spreadSlippageK?: number;
  impactBps?: number;
  allowTradeAfterClose?: boolean;
  riskLimits: RiskLimits;
  fillModel: FillModel;
};

function isLiveOrder(status: OrderRecord["status"]): boolean {
  return status === "ACCEPTED" || status === "PARTIALLY_FILLED";
}

function toMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export class SimulatedExecutionEngine implements ExecutionEngine {
  readonly mode: ExecutionMode;
  private orderSeq = 1;
  private eventSeq = 1;
  private readonly risk: PredictionRiskEngine;
  private readonly ledger: PredictionLedger;
  private readonly fillModel: FillModel;
  private readonly feeRate: number;
  private readonly slippageBps: number;
  private readonly chainCostPerFill: number;
  private readonly fixedFee: number;
  private readonly networkCost: number;
  private readonly latencyMs: number;
  private readonly maxFillRatioPerTick: number;
  private readonly spreadSlippageK: number;
  private readonly impactBps: number;
  private readonly allowTradeAfterClose: boolean;
  private readonly orders = new Map<string, OrderRecord>();
  private readonly fills: ExecutionSnapshot["fills"] = [];
  private readonly settlements: ExecutionSnapshot["settlements"] = [];
  private readonly eventStore = new EventStore();
  private readonly settledMarkets = new Set<string>();

  constructor(config: SimulationConfig) {
    this.mode = config.mode;
    this.ledger = new PredictionLedger(config.initialCash);
    this.fillModel = config.fillModel;
    this.risk = new PredictionRiskEngine(config.riskLimits);
    this.feeRate = config.feeRate;
    this.slippageBps = config.slippageBps;
    this.chainCostPerFill = config.chainCostPerFill;
    this.fixedFee = config.fixedFee ?? 0;
    this.networkCost = config.networkCost ?? 0;
    this.latencyMs = Math.max(0, config.latencyMs ?? 500);
    this.maxFillRatioPerTick = Math.min(1, Math.max(0.01, config.maxFillRatioPerTick ?? 0.2));
    this.spreadSlippageK = Math.max(0, config.spreadSlippageK ?? 0.25);
    this.impactBps = Math.max(0, config.impactBps ?? 10);
    this.allowTradeAfterClose = config.allowTradeAfterClose ?? false;
  }

  syncCash(cash: number): void {
    this.ledger.syncCash(cash);
  }

  async submit(request: OrderRequest, quote: MarketQuote): Promise<ExecutionResult> {
    const orderId = request.id ?? `ORD-${this.mode}-${this.orderSeq++}`;
    const nowTs = request.createdAtMs;
    const order: OrderRecord = {
      id: orderId,
      mode: this.mode,
      marketId: request.marketId,
      outcomeId: request.outcomeId,
      side: request.side,
      type: request.type,
      tif: request.tif ?? "GTC",
      quantity: roundTo(request.quantity, DEFAULT_DECIMALS.qtyDp),
      limitPrice:
        request.type === "MARKET"
          ? null
          : request.limitPrice !== undefined
            ? roundTo(request.limitPrice, DEFAULT_DECIMALS.priceDp)
            : null,
      status: "PENDING_NEW",
      filledQuantity: 0,
      remainingQuantity: roundTo(request.quantity, DEFAULT_DECIMALS.qtyDp),
      averageFillPrice: 0,
      totalFee: 0,
      createdAtMs: nowTs,
      enterBookAtMs: nowTs + this.latencyMs,
      enteredBookAtMs: null,
      updatedAtMs: nowTs,
      expiresAtMs: request.expiresAtMs ?? null,
      externalOrderId: null,
      strategyId: request.strategyId,
      runId: request.runId,
      tags: request.tags,
    };

    const events: ExecutionEvent[] = [
      this.pushEvent("OrderCreated", nowTs, {
        orderId: order.id,
        marketId: order.marketId,
        outcomeId: order.outcomeId,
        payload: {
          tif: order.tif,
          qty: order.quantity,
          enterBookAtMs: order.enterBookAtMs,
        },
      }),
    ];

    if (this.settledMarkets.has(order.marketId)) {
      order.status = "REJECTED";
      order.rejectReason = "market_already_resolved";
      this.orders.set(order.id, { ...order });
      events.push(
        this.pushEvent("OrderRejected", nowTs, {
          orderId: order.id,
          marketId: order.marketId,
          outcomeId: order.outcomeId,
          stateAfter: order.status,
          reason: order.rejectReason,
        }),
      );
      return { order: { ...order }, fills: [], events, ledger: this.ledger.snapshot() };
    }

    if (!this.allowTradeAfterClose) {
      const closeTs = toMs(order.tags?.marketCloseTs);
      if (closeTs !== null && order.createdAtMs >= closeTs) {
        order.status = "REJECTED";
        order.rejectReason = "market_closed";
        this.orders.set(order.id, { ...order });
        events.push(
          this.pushEvent("OrderRejected", nowTs, {
            orderId: order.id,
            marketId: order.marketId,
            outcomeId: order.outcomeId,
            stateAfter: order.status,
            reason: order.rejectReason,
          }),
        );
        return { order: { ...order }, fills: [], events, ledger: this.ledger.snapshot() };
      }
    }

    const risk = this.risk.evaluate({
      request,
      quote,
      ledger: this.ledger.snapshot(),
      openOrders: this.countOpenOrders(),
      marketExposure: this.ledger.marketExposure(order.marketId),
      realizedLossToday: Math.max(0, -this.ledger.snapshot().realizedPnl),
    });
    if (!risk.ok) {
      order.status = "REJECTED";
      order.rejectReason = risk.reason;
      this.orders.set(order.id, { ...order });
      events.push(
        this.pushEvent("OrderRejected", nowTs, {
          orderId: order.id,
          marketId: order.marketId,
          outcomeId: order.outcomeId,
          stateAfter: order.status,
          reason: order.rejectReason,
        }),
      );
      return { order: { ...order }, fills: [], events, ledger: this.ledger.snapshot() };
    }

    order.status = "ACCEPTED";
    order.updatedAtMs = nowTs;
    this.orders.set(order.id, { ...order });
    events.push(
      this.pushEvent("OrderAccepted", nowTs, {
        orderId: order.id,
        marketId: order.marketId,
        outcomeId: order.outcomeId,
        stateAfter: order.status,
      }),
    );

    return {
      order: { ...order },
      fills: [],
      events,
      ledger: this.ledger.snapshot(),
    };
  }

  async onMarketDataTick(quote: MarketQuote): Promise<ExecutionEvent[]> {
    return this.processQuote(quote);
  }

  async onTime(nowTs: number): Promise<ExecutionEvent[]> {
    const events: ExecutionEvent[] = [];
    events.push(...this.activateOrders(nowTs));
    events.push(...(await this.expireOrders(nowTs)));
    return events;
  }

  async onResolution(settlement: MarketSettlement): Promise<SettlementResult> {
    return this.settle(settlement);
  }

  async processQuote(quote: MarketQuote): Promise<ExecutionEvent[]> {
    const events: ExecutionEvent[] = [];
    events.push(...this.activateOrders(quote.ts, quote.marketId));
    events.push(...(await this.expireOrders(quote.ts)));

    const openOrders = [...this.orders.values()]
      .filter(
        (item) =>
          item.marketId === quote.marketId &&
          isLiveOrder(item.status) &&
          item.enteredBookAtMs !== null &&
          item.enteredBookAtMs <= quote.ts,
      )
      .sort((a, b) => a.createdAtMs - b.createdAtMs);

    for (const order of openOrders) {
      const result = this.matchOrder(order, quote);
      events.push(...result.events);
      this.orders.set(order.id, { ...order });
    }

    return events;
  }

  async cancelOrder(orderId: string, ts: number, reason = "manual_cancel"): Promise<CancelResult> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error("order_not_found");
    }
    if (!isLiveOrder(order.status)) {
      throw new Error("order_not_cancelable");
    }

    order.status = "CANCELED";
    order.updatedAtMs = ts;
    this.orders.set(order.id, { ...order });
    const event = this.pushEvent("OrderCanceled", ts, {
      orderId: order.id,
      marketId: order.marketId,
      outcomeId: order.outcomeId,
      stateAfter: order.status,
      reason,
    });
    return { order: { ...order }, events: [event] };
  }

  async expireOrders(nowTs: number): Promise<ExecutionEvent[]> {
    const events: ExecutionEvent[] = [];
    for (const order of this.orders.values()) {
      if (!isLiveOrder(order.status)) {
        continue;
      }
      if (!order.expiresAtMs || order.expiresAtMs > nowTs) {
        continue;
      }
      order.status = "EXPIRED";
      order.updatedAtMs = nowTs;
      this.orders.set(order.id, { ...order });
      events.push(
        this.pushEvent("OrderExpired", nowTs, {
          orderId: order.id,
          marketId: order.marketId,
          outcomeId: order.outcomeId,
          stateAfter: order.status,
          reason: "ttl_expired",
        }),
      );
    }
    return events;
  }

  async settle(settlement: MarketSettlement): Promise<SettlementResult> {
    this.settledMarkets.add(settlement.marketId);
    const row = this.ledger.applySettlement(settlement);
    this.settlements.unshift(row);

    const events: ExecutionEvent[] = [];
    events.push(
      this.pushEvent("MarketResolved", settlement.ts, {
        marketId: settlement.marketId,
        payload: {
          reason: settlement.reason,
          winningOutcomeId: settlement.winningOutcomeId,
          observedTemperatureC: settlement.observedTemperatureC,
          source: settlement.source,
        },
      }),
    );
    events.push(
      this.pushEvent("PositionSettled", settlement.ts, {
        marketId: settlement.marketId,
        settlement: row,
      }),
    );
    events.push(
      this.pushEvent("SettlementApplied", settlement.ts, {
        marketId: settlement.marketId,
        settlement: row,
      }),
    );

    return {
      settlement: row,
      events,
      ledger: this.ledger.snapshot(),
    };
  }

  getSnapshot(): ExecutionSnapshot {
    return {
      mode: this.mode,
      orders: [...this.orders.values()].sort((a, b) => b.createdAtMs - a.createdAtMs),
      fills: [...this.fills],
      settlements: [...this.settlements],
      ledger: this.ledger.snapshot(),
    };
  }

  listEvents(limit = 500): ExecutionEvent[] {
    return this.eventStore.list(limit);
  }

  getAuditJsonl(limit = 5000): string {
    return this.eventStore.toJsonl(limit);
  }

  hydrate(snapshot: ExecutionSnapshot, events: ExecutionEvent[] = []): void {
    this.orders.clear();
    for (const row of snapshot.orders) {
      this.orders.set(row.id, { ...row });
    }
    this.fills.splice(0, this.fills.length, ...snapshot.fills.map((row) => ({ ...row })));
    this.settlements.splice(0, this.settlements.length, ...snapshot.settlements.map((row) => ({ ...row })));
    this.ledger.hydrate(snapshot.ledger);

    this.settledMarkets.clear();
    for (const row of snapshot.settlements) {
      this.settledMarkets.add(row.marketId);
    }

    this.eventStore.replace(events.map((row) => ({ ...row })));
    this.orderSeq = Math.max(1, snapshot.orders.length + 1);
    this.eventSeq = Math.max(1, events.length + 1);
  }

  private countOpenOrders(): number {
    return [...this.orders.values()].filter((order) => isLiveOrder(order.status)).length;
  }

  private activateOrders(nowTs: number, marketId?: string): ExecutionEvent[] {
    const events: ExecutionEvent[] = [];
    for (const order of this.orders.values()) {
      if (!isLiveOrder(order.status)) {
        continue;
      }
      if (order.enteredBookAtMs !== null || order.enterBookAtMs > nowTs) {
        continue;
      }
      if (marketId && order.marketId !== marketId) {
        continue;
      }
      order.enteredBookAtMs = nowTs;
      order.updatedAtMs = nowTs;
      this.orders.set(order.id, { ...order });
      events.push(
        this.pushEvent("OrderEnteredBook", nowTs, {
          orderId: order.id,
          marketId: order.marketId,
          outcomeId: order.outcomeId,
          stateAfter: order.status,
          payload: {
            enterDelayMs: Math.max(0, nowTs - order.createdAtMs),
          },
        }),
      );
    }
    return events;
  }

  private matchOrder(
    order: OrderRecord,
    quote: MarketQuote,
  ): { events: ExecutionEvent[]; fills: ExecutionSnapshot["fills"] } {
    if (!isLiveOrder(order.status) || order.enteredBookAtMs === null || order.enteredBookAtMs > quote.ts) {
      return { events: [], fills: [] };
    }

    const result = this.fillModel.match(order, quote, {
      feeRate: this.feeRate,
      slippageBps: this.slippageBps,
      chainCostPerFill: this.chainCostPerFill,
      fixedFee: this.fixedFee,
      networkCost: this.networkCost,
      maxFillRatioPerTick: order.tif === "FOK" ? 1 : this.maxFillRatioPerTick,
      spreadSlippageK: this.spreadSlippageK,
      impactBps: this.impactBps,
    });

    if (order.tif === "FOK" && result.remainingQuantity > 0) {
      order.status = "CANCELED";
      order.updatedAtMs = quote.ts;
      return {
        fills: [],
        events: [
          this.pushEvent("OrderCanceled", quote.ts, {
            orderId: order.id,
            marketId: order.marketId,
            outcomeId: order.outcomeId,
            stateAfter: order.status,
            reason: "fok_not_fully_fillable",
          }),
        ],
      };
    }

    if (result.fills.length === 0) {
      if (order.tif === "IOC") {
        order.status = "CANCELED";
        order.updatedAtMs = quote.ts;
        return {
          fills: [],
          events: [
            this.pushEvent("OrderCanceled", quote.ts, {
              orderId: order.id,
              marketId: order.marketId,
              outcomeId: order.outcomeId,
              stateAfter: order.status,
              reason: "ioc_unfilled",
            }),
          ],
        };
      }
      return { events: [], fills: [] };
    }

    const events: ExecutionEvent[] = [];
    const fills = [...result.fills];
    for (const fill of fills) {
      this.ledger.applyFill(fill);
      this.fills.unshift(fill);
      events.push(
        this.pushEvent("OrderPartiallyFilled", fill.ts, {
          orderId: order.id,
          marketId: order.marketId,
          outcomeId: order.outcomeId,
          stateAfter: "PARTIALLY_FILLED",
          fill,
          payload: {
            pricing: {
              bookPrice: fill.bookPrice,
              spreadAdj: fill.spreadAdj,
              impactAdj: fill.impactAdj,
              finalPrice: fill.price,
            },
            fees: fill.feeBreakdown,
          },
        }),
      );
    }

    order.filledQuantity = roundTo(order.filledQuantity + result.filledQuantity, DEFAULT_DECIMALS.qtyDp);
    order.remainingQuantity = result.remainingQuantity;
    order.totalFee = roundTo(
      order.totalFee + fills.reduce((sum, fill) => sum + fill.fee, 0),
      DEFAULT_DECIMALS.cashDp,
    );
    const weighted = fills.reduce((sum, fill) => sum + fill.price * fill.quantity, 0);
    if (order.filledQuantity > 0) {
      const prevWeighted = order.averageFillPrice * (order.filledQuantity - result.filledQuantity);
      order.averageFillPrice = roundTo((prevWeighted + weighted) / order.filledQuantity, DEFAULT_DECIMALS.priceDp);
    }
    order.updatedAtMs = quote.ts;

    if (order.remainingQuantity <= 0) {
      order.status = "FILLED";
      events.push(
        this.pushEvent("OrderFilled", quote.ts, {
          orderId: order.id,
          marketId: order.marketId,
          outcomeId: order.outcomeId,
          stateAfter: order.status,
          fill: fills[fills.length - 1],
        }),
      );
      return { events, fills };
    }

    order.status = "PARTIALLY_FILLED";
    if (order.tif === "IOC") {
      order.status = "CANCELED";
      events.push(
        this.pushEvent("OrderCanceled", quote.ts, {
          orderId: order.id,
          marketId: order.marketId,
          outcomeId: order.outcomeId,
          stateAfter: order.status,
          reason: "ioc_partial_then_cancel",
        }),
      );
    }
    return { events, fills };
  }

  private pushEvent(
    type: ExecutionEvent["type"],
    ts: number,
    payload: Omit<ExecutionEvent, "eventId" | "mode" | "type" | "ts">,
  ): ExecutionEvent {
    const event: ExecutionEvent = {
      eventId: `EV-${this.mode}-${this.eventSeq++}`,
      mode: this.mode,
      type,
      ts,
      ...payload,
    };
    this.eventStore.append(event);
    return event;
  }
}
