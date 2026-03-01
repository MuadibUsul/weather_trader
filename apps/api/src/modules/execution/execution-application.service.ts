import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { BadRequestException, Injectable, Logger, Optional } from "@nestjs/common";
import { createModeManager } from "@weather-trader/core";
import type { RealOrderGateway } from "@weather-trader/core";
import { Prisma } from "@prisma/client";
import type { Environment, MarketDto, OrderLifecycleEventDto, OrderPreviewDto, OrderQuoteDto } from "@weather-trader/shared";
import { EventsGateway } from "../../gateway/events.gateway";
import { PrismaService } from "../../prisma.service";
import { ControlAllocatorService } from "../control/control.allocator.service";
import { ControlRiskService } from "../control/control.risk.service";
import { ControlStoreService } from "../control/control.store";
import { MarketsService } from "../markets/markets.service";
import { CreateOrderDto } from "../orders/dto/create-order.dto";
import { ListOrdersQueryDto } from "../orders/dto/list-orders-query.dto";
import { PreviewOrderDto } from "../orders/dto/preview-order.dto";
import { SystemService } from "../system/system.service";

export type OrderView = {
  id: string;
  strategyId?: string;
  walletId?: string;
  contractName?: string;
  marketId: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  amount: number;
  fee: number;
  pnl: number;
  environment: "REAL" | "PAPER";
  status: "filled" | "open" | "cancelled";
  createdAt: string;
};

export type WalletSnapshotView = {
  environment: "PAPER" | "REAL";
  walletId: string;
  unit: string;
  cash: number;
  reservedCash: number;
  pendingBuyNotional: number;
  availableCash: number;
  marketValue: number;
  equity: number;
  realizedPnl: number;
  settledPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  openOrders: number;
  livePositions: number;
  fills24h: number;
  fees24h: number;
  turnover24h: number;
  positions: Array<{
    key: string;
    marketId: string;
    outcomeId: string;
    quantity: number;
    averageCost: number;
    markPrice: number;
    marketValue: number;
    unrealizedPnl: number;
    realizedPnl: number;
  }>;
  updatedAt: string;
};

type PersistedOrderStore = {
  version: 3;
  orders: OrderView[];
  orderEvents: Record<string, OrderLifecycleEventDto[]>;
  snapshots: Record<ExecutionMode, unknown>;
};

const STORE_VERSION = 3;
const OUTCOME_YES = "YES";
type ExecutionMode = "PAPER" | "REAL";
type PolymarketExecutionEvent = {
  eventId: string;
  mode: ExecutionMode;
  type: string;
  ts: number;
  orderId?: string;
  stateAfter?: string;
  reason?: string;
  fill?: {
    price: number;
    quantity: number;
    notional: number;
    fee: number;
  };
};

type FetchResponseLike = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<FetchResponseLike>;

type ExternalVenueOrderCommand = {
  id: string;
  marketId: string;
  side: "BUY" | "SELL";
  quantity: number;
  limitPrice?: number;
  createdAtMs: number;
};

interface ExternalVenueGateway {
  sendOrder(order: ExternalVenueOrderCommand): Promise<{ externalOrderId: string }>;
}

function mapOrderStatus(state: string): OrderView["status"] {
  switch (state) {
    case "FILLED":
      return "filled";
    case "CANCELED":
    case "EXPIRED":
      return "cancelled";
    default:
      return "open";
  }
}

class StubExternalVenueGateway implements ExternalVenueGateway {
  private seq = 1;

  async sendOrder(_order: ExternalVenueOrderCommand): Promise<{ externalOrderId: string }> {
    return { externalOrderId: `STUB-${Date.now()}-${this.seq++}` };
  }
}

class HttpExternalVenueGateway implements ExternalVenueGateway {
  constructor(
    private readonly endpoint: string,
    private readonly apiKey?: string,
  ) {}

  async sendOrder(order: ExternalVenueOrderCommand): Promise<{ externalOrderId: string }> {
    const fetchFn = this.resolveFetch();
    const response = await fetchFn(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        orderId: order.id,
        symbol: order.marketId,
        side: order.side === "BUY" ? "buy" : "sell",
        quantity: order.quantity,
        limitPrice: order.limitPrice,
        timestamp: order.createdAtMs,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`external_gateway_http_${response.status}:${raw.slice(0, 120)}`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      throw new Error("external_gateway_invalid_json");
    }

    if (!payload || typeof payload !== "object") {
      throw new Error("external_gateway_invalid_payload");
    }

    const externalOrderId = (payload as { externalOrderId?: unknown }).externalOrderId;
    if (typeof externalOrderId !== "string" || externalOrderId.length === 0) {
      throw new Error("external_gateway_missing_external_order_id");
    }

    return { externalOrderId };
  }

  private resolveFetch(): FetchLike {
    const maybeFetch = (globalThis as { fetch?: unknown }).fetch;
    if (typeof maybeFetch !== "function") {
      throw new Error("fetch_not_available");
    }
    return maybeFetch as FetchLike;
  }
}

class DirectPolymarketVenueGateway implements ExternalVenueGateway {
  constructor(
    private readonly host: string,
    private readonly apiKey?: string,
  ) {}

  async sendOrder(order: ExternalVenueOrderCommand): Promise<{ externalOrderId: string }> {
    const fetchFn = this.resolveFetch();
    const endpoint = `${this.host.replace(/\/+$/, "")}/order`;
    const response = await fetchFn(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        market: order.marketId,
        side: order.side === "BUY" ? "buy" : "sell",
        size: order.quantity,
        price: order.limitPrice,
        clientOrderId: order.id,
        timestamp: order.createdAtMs,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`direct_polymarket_http_${response.status}:${raw.slice(0, 120)}`);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw) as unknown;
    } catch {
      throw new Error("direct_polymarket_invalid_json");
    }
    if (!payload || typeof payload !== "object") {
      throw new Error("direct_polymarket_invalid_payload");
    }
    const externalOrderId =
      (payload as { orderID?: unknown }).orderID ??
      (payload as { id?: unknown }).id ??
      (payload as { externalOrderId?: unknown }).externalOrderId;
    if (typeof externalOrderId !== "string" || externalOrderId.length === 0) {
      throw new Error("direct_polymarket_missing_order_id");
    }
    return { externalOrderId };
  }

  private resolveFetch(): FetchLike {
    const maybeFetch = (globalThis as { fetch?: unknown }).fetch;
    if (typeof maybeFetch !== "function") {
      throw new Error("fetch_not_available");
    }
    return maybeFetch as FetchLike;
  }
}

class ExternalVenueOrderGateway implements RealOrderGateway {
  constructor(private readonly gateway: ExternalVenueGateway) {}

  async placeOrder(
    request: Parameters<RealOrderGateway["placeOrder"]>[0],
  ): Promise<{ externalOrderId: string; accepted: boolean; reason?: string }> {
    const ack = await this.gateway.sendOrder({
      id: request.id ?? `ORD-${Date.now()}`,
      createdAtMs: request.createdAtMs,
      marketId: request.marketId,
      side: request.side,
      quantity: request.quantity,
      ...(request.limitPrice !== undefined ? { limitPrice: request.limitPrice } : {}),
    });
    return {
      externalOrderId: ack.externalOrderId,
      accepted: true,
    };
  }
}

@Injectable()
export class ExecutionApplicationService {
  private readonly logger = new Logger(ExecutionApplicationService.name);
  private readonly orders: OrderView[] = [];
  private readonly orderEvents = new Map<string, OrderLifecycleEventDto[]>();
  private orderSequence = 0;
  private readonly storePath = resolve(process.cwd(), process.env.ORDER_STORE_PATH ?? "runtime/orders-store.json");
  private readonly persistenceEnabled =
    process.env.ORDER_PERSISTENCE !== "off" &&
    (process.env.NODE_ENV !== "test" || process.env.ORDER_PERSISTENCE_IN_TEST === "true");
  private readonly persistenceBackend = (process.env.ORDER_STORE_BACKEND ?? "postgres").toLowerCase();
  private readonly usePostgresPrimary = this.persistenceEnabled && this.persistenceBackend !== "json";
  private readonly mirrorJsonStore = process.env.ORDER_STORE_MIRROR_JSON === "true";
  private readonly requireRealGateway =
    process.env.NODE_ENV !== "test" && process.env.REAL_EXECUTION_REQUIRED !== "false";
  private readonly executionLatencyMs = Math.max(0, Number(process.env.EXEC_LATENCY_MS ?? 500));
  private readonly realExecutionRoute = (process.env.REAL_EXECUTION_ROUTE ?? "gateway").toLowerCase();

  private readonly externalGateway: ExternalVenueGateway;
  private readonly isStubGateway: boolean;
  private readonly resolvedRealRoute: "gateway" | "direct" | "stub";
  private readonly modeManager: ReturnType<typeof createModeManager>;

  constructor(
    private readonly events: EventsGateway,
    private readonly system: SystemService,
    private readonly controlStore: ControlStoreService,
    private readonly controlRisk: ControlRiskService,
    private readonly allocator: ControlAllocatorService,
    private readonly markets: MarketsService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    const gateway = this.buildGateway();
    this.externalGateway = gateway.gateway;
    this.isStubGateway = gateway.stub;
    this.resolvedRealRoute = gateway.route;

    this.modeManager = createModeManager({
      config: {
        feeRate: Number(process.env.EXEC_FEE_RATE ?? 0.001),
        slippageBps: Number(process.env.EXEC_SLIPPAGE_BPS ?? 15),
        chainCostPerFill: Number(process.env.EXEC_CHAIN_COST_PER_FILL ?? 0),
        fixedFee: Number(process.env.EXEC_FIXED_FEE ?? 0),
        networkCost: Number(process.env.EXEC_NETWORK_COST ?? 0),
        latencyMs: this.executionLatencyMs,
        maxFillRatioPerTick: Number(process.env.EXEC_MAX_FILL_RATIO_PER_TICK ?? 0.2),
        spreadSlippageK: Number(process.env.EXEC_SPREAD_SLIPPAGE_K ?? 0.25),
        impactBps: Number(process.env.EXEC_IMPACT_BPS ?? 10),
        allowTradeAfterClose: process.env.EXEC_ALLOW_TRADE_AFTER_CLOSE === "true",
        risk: {
          maxNotionalPerOrder: Number(process.env.MAX_NOTIONAL_PER_ORDER ?? 100000),
          maxPositionPerOutcome: Number(process.env.MAX_POSITION_PER_SYMBOL ?? 100000),
          maxExposurePerMarket: Number(process.env.MAX_EXPOSURE_PER_MARKET ?? 100000),
          maxOpenOrders: Number(process.env.MAX_OPEN_ORDERS ?? 100),
          maxDailyLoss: Number(process.env.MAX_DAILY_LOSS ?? 100000),
        },
      },
      initialCash: {
        PAPER: this.system.getProfile("PAPER").wallet.balance,
        REAL: this.system.getProfile("REAL").wallet.balance,
      },
      gateway: new ExternalVenueOrderGateway(this.externalGateway),
      initialMode: this.system.getEnvironment(),
    });

    if (this.persistenceEnabled) {
      void this.restoreStore();
    }
  }

  list(query: ListOrdersQueryDto = {}): OrderView[] {
    const { environment, status, limit, page } = query;
    const filtered = this.orders.filter((item) => {
      if (environment && item.environment !== environment) {
        return false;
      }
      if (status && item.status !== status) {
        return false;
      }
      return true;
    });

    const safeLimit = limit ?? 200;
    const safePage = Math.max(page ?? 1, 1);
    const offset = (safePage - 1) * safeLimit;
    return filtered.slice(offset, offset + safeLimit);
  }

  async getWalletSnapshot(environment?: Environment): Promise<WalletSnapshotView> {
    const resolvedEnvironment = environment ?? this.system.getEnvironment();
    const profile = this.system.getProfile(resolvedEnvironment);
    const snapshot = this.getEngine(resolvedEnvironment).getSnapshot();
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const openOrders = snapshot.orders.filter((item) => item.status === "ACCEPTED" || item.status === "PARTIALLY_FILLED");
    const pendingBuyNotional = Number(
      openOrders
        .filter((item) => item.side === "BUY")
        .reduce((sum, item) => sum + item.remainingQuantity * Math.max(0, item.limitPrice ?? 0), 0)
        .toFixed(4),
    );
    const fills24hRows = snapshot.fills.filter((item) => item.ts >= dayAgo);
    const fills24h = fills24hRows.length;
    const fees24h = Number(fills24hRows.reduce((sum, item) => sum + item.fee, 0).toFixed(4));
    const turnover24h = Number(fills24hRows.reduce((sum, item) => sum + item.notional, 0).toFixed(4));

    const marketMap = new Map<string, MarketDto>();
    try {
      const marketRows = await this.markets.getMarkets();
      for (const row of marketRows) {
        marketMap.set(row.id, row);
      }
    } catch (error) {
      this.logger.warn(`wallet snapshot market lookup failed: ${(error as Error).message}`);
    }

    const positions = Object.entries(snapshot.ledger.positions).map(([key, position]) => {
      const market = marketMap.get(position.marketId);
      const yesMid = market
        ? this.clampPrice(market.odds)
        : position.averageCost;
      const outcomeUpper = position.outcomeId.toUpperCase();
      const markPrice = outcomeUpper === "NO" ? this.clampPrice(1 - yesMid) : yesMid;
      const marketValue = Number((position.quantity * markPrice).toFixed(4));
      const unrealizedPnl = Number(((markPrice - position.averageCost) * position.quantity).toFixed(4));
      return {
        key,
        marketId: position.marketId,
        outcomeId: position.outcomeId,
        quantity: position.quantity,
        averageCost: position.averageCost,
        markPrice,
        marketValue,
        unrealizedPnl,
        realizedPnl: position.realizedPnl,
      };
    });
    const marketValue = Number(positions.reduce((sum, item) => sum + item.marketValue, 0).toFixed(4));
    const unrealizedPnl = Number(positions.reduce((sum, item) => sum + item.unrealizedPnl, 0).toFixed(4));
    const reservedCash = Number(Math.max(snapshot.ledger.reservedCash, pendingBuyNotional).toFixed(4));
    const availableCash = Number((snapshot.ledger.cash - reservedCash).toFixed(4));
    const equity = Number((snapshot.ledger.cash + marketValue).toFixed(4));
    const realizedPnl = Number(snapshot.ledger.realizedPnl.toFixed(4));
    const settledPnl = Number(snapshot.ledger.settledPnl.toFixed(4));
    const totalPnl = Number((realizedPnl + settledPnl + unrealizedPnl).toFixed(4));

    return {
      environment: resolvedEnvironment,
      walletId: profile.wallet.address,
      unit: profile.wallet.unit,
      cash: Number(snapshot.ledger.cash.toFixed(4)),
      reservedCash,
      pendingBuyNotional,
      availableCash,
      marketValue,
      equity,
      realizedPnl,
      settledPnl,
      unrealizedPnl,
      totalPnl,
      openOrders: openOrders.length,
      livePositions: positions.length,
      fills24h,
      fees24h,
      turnover24h,
      positions: positions.sort((a, b) => Math.abs(b.unrealizedPnl) - Math.abs(a.unrealizedPnl)),
      updatedAt: new Date(now).toISOString(),
    };
  }

  getExecutionHealth() {
    return {
      route: {
        configured: this.realExecutionRoute,
        resolved: this.resolvedRealRoute,
        ready: !this.isStubGateway,
      },
      persistence: {
        enabled: this.persistenceEnabled,
        backend: this.persistenceBackend,
        postgresPrimary: this.usePostgresPrimary,
        mirrorJson: this.mirrorJsonStore,
      },
    };
  }

  listOpen(environment?: Environment, limit = 200): OrderView[] {
    const safeLimit = Math.max(1, Math.min(limit, 2000));
    return this.orders
      .filter((item) => item.status === "open" && (!environment || item.environment === environment))
      .slice(0, safeLimit);
  }

  listEvents(orderId: string, limit = 100): OrderLifecycleEventDto[] {
    return (this.orderEvents.get(orderId) ?? []).slice(0, Math.max(1, Math.min(limit, 1000)));
  }

  async cancel(orderId: string, reason = "manual_cancel"): Promise<OrderView> {
    const index = this.orders.findIndex((item) => item.id === orderId);
    if (index < 0) {
      throw new BadRequestException("order_not_found");
    }
    const order = this.orders[index];
    if (order.status !== "open") {
      throw new BadRequestException("order_not_cancelable");
    }

    const engine = this.getEngine(order.environment);
    let cancelResult: Awaited<ReturnType<typeof engine.cancelOrder>>;
    try {
      cancelResult = await engine.cancelOrder(order.id, Date.now(), reason);
    } catch (error) {
      if (error instanceof Error && (error.message === "order_not_found" || error.message === "order_not_cancelable")) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException("cancel_failed");
    }

    const updated: OrderView = {
      ...order,
      status: mapOrderStatus(cancelResult.order.status),
    };
    this.orders[index] = updated;

    const mappedEvents = this.mapExecutionEvents(updated, cancelResult.events);
    const existing = this.orderEvents.get(updated.id) ?? [];
    this.orderEvents.set(
      updated.id,
      [...existing, ...mappedEvents].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 1000),
    );

    this.controlStore.patchOrder(updated.id, { status: "canceled" });

    const snapshot = engine.getSnapshot();
    this.system.patchWallet(order.environment, { balance: snapshot.ledger.cash }, `order ${order.id} canceled`);
    this.system.recordAudit("ORDER_CANCELED", "SUCCESS", `${order.id} ${reason}`, order.environment);
    this.events.emitOrderUpdate({
      order: updated,
      events: cancelResult.events,
      ledger: snapshot.ledger,
    });

    if (this.persistenceEnabled) {
      await this.persistStore();
    }

    return updated;
  }

  async quote(params: { marketId: string; environment?: Environment }): Promise<OrderQuoteDto> {
    const environment = this.system.getEnvironment();
    if (params.environment && params.environment !== environment) {
      throw new BadRequestException("environment_mismatch_with_global_mode");
    }

    const market = await this.findMarket(params.marketId);
    const bestBid = this.clampPrice(market.bestBid ?? market.odds - 0.01);
    const bestAsk = this.clampPrice(market.bestAsk ?? market.odds + 0.01);
    const midPrice = this.clampPrice((bestBid + bestAsk) / 2);
    const spreadBps = Number((((bestAsk - bestBid) / Math.max(bestAsk, 0.0001)) * 10000).toFixed(2));
    return {
      marketId: market.id,
      bestBid,
      bestAsk,
      midPrice,
      spreadBps,
      source: market.source ?? "SEED",
      updatedAt: new Date().toISOString(),
    };
  }

  async preview(input: PreviewOrderDto): Promise<OrderPreviewDto> {
    const environment = this.system.getEnvironment();
    if (input.environment && input.environment !== environment) {
      throw new BadRequestException("environment_mismatch_with_global_mode");
    }

    const market = await this.findMarket(input.marketId);
    const profile = this.system.ensureExecutionReady(environment);
    const quote = await this.quote({ marketId: input.marketId, environment });
    const suggestedPrice = input.side === "buy" ? quote.bestAsk : quote.bestBid;
    const requestedPrice = this.clampPrice(input.price > 0 ? input.price : suggestedPrice);
    const baseQuantity = Math.max(0, Number(input.quantity));
    const strategyId = input.strategyId ?? null;
    const allocationFactor = strategyId ? this.allocator.getExecutionFactor(strategyId, environment) : 1;
    const riskPreview = this.controlRisk.previewPreTrade({
      env: environment,
      strategyId,
      marketId: input.marketId,
      price: requestedPrice,
      size: baseQuantity * allocationFactor,
      slippageBps: input.slippageBps,
    });
    const finalQuantity = Number((baseQuantity * allocationFactor * riskPreview.riskFactor).toFixed(6));
    const notional = Number((requestedPrice * finalQuantity).toFixed(4));
    const feeRate = Number(process.env.EXEC_FEE_RATE ?? 0.001);
    const estimatedFee = Number((notional * feeRate).toFixed(4));
    const estimatedSlippageBps = Number(
      (
        Math.max(1, quote.spreadBps * 0.35) +
        Math.min(120, (notional / Math.max(market.oi, 50000)) * 8000)
      ).toFixed(2),
    );
    const direction = input.side === "buy" ? 1 : -1;
    const estimatedFillPrice = this.clampPrice(
      requestedPrice * (1 + direction * (estimatedSlippageBps / 10000)),
    );

    if (notional > profile.wallet.balance) {
      return {
        marketId: market.id,
        environment,
        side: input.side,
        requestedPrice,
        suggestedPrice,
        quantity: baseQuantity,
        finalQuantity,
        notional,
        estimatedFee,
        estimatedSlippageBps,
        estimatedFillPrice,
        risk: {
          pass: false,
          reason: "insufficient_balance",
        },
      };
    }

    return {
      marketId: market.id,
      environment,
      side: input.side,
      requestedPrice,
      suggestedPrice,
      quantity: baseQuantity,
      finalQuantity,
      notional,
      estimatedFee,
      estimatedSlippageBps,
      estimatedFillPrice,
      risk: {
        pass: riskPreview.pass,
        ...(riskPreview.reason ? { reason: riskPreview.reason } : {}),
      },
    };
  }

  async create(input: CreateOrderDto): Promise<OrderView> {
    const environment = this.system.getEnvironment();

    if (input.environment && input.environment !== environment) {
      throw new BadRequestException("environment_mismatch_with_global_mode");
    }

    if (environment === "REAL" && this.requireRealGateway && this.isStubGateway) {
      throw new BadRequestException("real_gateway_not_configured");
    }

    const profile = this.system.ensureExecutionReady(environment);
    const market = await this.findMarket(input.marketId);
    const strategyId = input.strategyId ?? null;
    const runId = input.runId ?? null;
    const walletId = input.walletId ?? profile.wallet.address;

    if (input.quantity <= 0 || input.price <= 0) {
      throw new BadRequestException("invalid_order_params");
    }

    const allocationFactor = strategyId ? this.allocator.getExecutionFactor(strategyId, environment) : 1;
    const { riskFactor } = this.controlRisk.checkPreTrade({
      env: environment,
      strategyId,
      marketId: input.marketId,
      price: input.price,
      size: input.quantity * allocationFactor,
      slippageBps: input.slippageBps,
    });
    const finalSize = Number((input.quantity * allocationFactor * riskFactor).toFixed(6));
    if (finalSize <= 0) {
      throw new BadRequestException("final_order_size_zero");
    }

    const engine = this.getEngine(environment);
    this.syncEngineCash(environment, profile.wallet.balance);
    const preLedger = engine.getSnapshot().ledger;
    const orderId = this.nextOrderId();
    const nowTs = Date.now();
    const quote = this.buildMarketQuote(market, nowTs);
    const request: Parameters<typeof engine.submit>[0] = {
      id: orderId,
      marketId: market.id,
      outcomeId: OUTCOME_YES,
      side: input.side === "buy" ? "BUY" : "SELL",
      type: input.orderType === "market" ? "MARKET" : "LIMIT",
      quantity: finalSize,
      limitPrice: input.orderType === "market" ? undefined : this.clampPrice(input.price),
      tif: input.orderType === "market" ? "IOC" : "GTC",
      createdAtMs: nowTs,
      strategyId: strategyId ?? undefined,
      runId: runId ?? undefined,
    };

    let submitResult: Awaited<ReturnType<typeof engine.submit>>;
    const lifecycleEvents: PolymarketExecutionEvent[] = [];
    try {
      submitResult = await engine.submit(request, quote);
      lifecycleEvents.push(...submitResult.events);
    } catch (error) {
      const reason = this.resolveGatewayError(error);
      this.controlRisk.reportApiError(environment, reason, strategyId, input.marketId);
      this.system.recordAudit("ORDER_REJECTED", "FAILED", reason, environment);
      this.events.emitRiskAlert({
        type: reason,
        environment,
      });
      throw new BadRequestException(reason);
    }

    if (submitResult.order.status === "REJECTED") {
      const reason =
        submitResult.order.rejectReason ??
        submitResult.events.find((item) => item.type === "OrderRejected")?.reason ??
        "order_rejected";
      this.system.recordAudit("ORDER_REJECTED", "FAILED", reason, environment);
      this.events.emitRiskAlert({
        type: reason,
        environment,
      });
      throw new BadRequestException(reason);
    }

    const matchTs = nowTs + this.executionLatencyMs;
    lifecycleEvents.push(...(await engine.onTime(matchTs)));
    lifecycleEvents.push(...(await engine.onMarketDataTick({ ...quote, ts: matchTs })));

    const snapshot = engine.getSnapshot();
    const orderRecord = snapshot.orders.find((item) => item.id === orderId) ?? submitResult.order;
    const orderFills = snapshot.fills.filter((item) => item.orderId === orderId);
    const amount = Number(orderFills.reduce((sum, fill) => sum + fill.notional, 0).toFixed(4));
    const fee = Number(orderFills.reduce((sum, fill) => sum + fill.fee, 0).toFixed(4));
    const postLedger = snapshot.ledger;
    const pnl = Number(
      (
        postLedger.realizedPnl +
        postLedger.settledPnl -
        (preLedger.realizedPnl + preLedger.settledPnl)
      ).toFixed(4),
    );
    const createdAt = new Date(orderRecord.createdAtMs).toISOString();

    const order: OrderView = {
      id: orderRecord.id,
      walletId,
      strategyId: strategyId ?? undefined,
      marketId: orderRecord.marketId,
      side: orderRecord.side === "BUY" ? "buy" : "sell",
      contractName: market.title,
      quantity: orderRecord.quantity,
      price: orderRecord.averageFillPrice > 0 ? orderRecord.averageFillPrice : orderRecord.limitPrice ?? input.price,
      amount,
      fee,
      pnl,
      environment,
      status: mapOrderStatus(orderRecord.status),
      createdAt,
    };

    const lifecycle = this.buildOrderLifecycle(order, lifecycleEvents);
    this.orderEvents.set(order.id, lifecycle);
    this.orders.unshift(order);

    const sideV2 = input.side === "buy" ? "long" : "short";
    const status =
      order.status === "filled" ? "filled" : order.status === "cancelled" ? "canceled" : ("accepted" as const);
    this.controlStore.addOrder({
      id: order.id,
      env: environment,
      walletId,
      strategyId,
      runId,
      marketId: order.marketId,
      side: sideV2,
      type: input.orderType ?? "limit",
      price: order.price,
      size: order.quantity,
      status,
      fee: order.fee,
      pnl: order.pnl,
      amount: order.amount,
      createdAt: order.createdAt,
    });
    for (const fill of orderFills) {
      this.controlStore.addFill({
        orderId: order.id,
        env: environment,
        price: fill.price,
        size: fill.quantity,
        fee: fill.fee,
        filledAt: new Date(fill.ts).toISOString(),
      });
    }
    this.controlStore.addPnlSnapshot({
      env: environment,
      strategyId: null,
      timestamp: createdAt,
      realizedPnl: order.pnl,
      unrealizedPnl: 0,
      fees: order.fee,
      equity: postLedger.cash,
    });
    if (strategyId) {
      this.controlStore.addPnlSnapshot({
        env: environment,
        strategyId,
        timestamp: createdAt,
        realizedPnl: order.pnl,
        unrealizedPnl: 0,
        fees: order.fee,
        equity: postLedger.cash,
      });
    }
    this.captureExposureSnapshot(environment);

    this.system.patchWallet(environment, { balance: postLedger.cash }, `order ${order.id} settled`);
    this.system.recordAudit(
      "ORDER_CREATED",
      "SUCCESS",
      `${order.id} ${order.side} ${order.marketId} ${order.quantity}@${order.price}`,
      environment,
    );

    if (environment === "REAL" && postLedger.cash < 500) {
      this.events.emitRiskAlert({
        type: "low_balance",
        environment,
        balance: postLedger.cash,
        threshold: 500,
      });
    }

    this.events.emitOrderUpdate({
      order,
      events: lifecycleEvents,
      ledger: postLedger,
    });
    this.events.emitSystemLog({
      level: "info",
      message: `Order ${order.id} created in ${environment}`,
      payload: { order, events: lifecycleEvents },
    });

    if (this.persistenceEnabled) {
      await this.persistStore();
    }

    return order;
  }

  private buildOrderLifecycle(order: OrderView, events: PolymarketExecutionEvent[]): OrderLifecycleEventDto[] {
    const submittedAt = new Date(order.createdAt).toISOString();
    const lifecycle: OrderLifecycleEventDto[] = [
      {
        eventId: `${order.id}-REQ`,
        orderId: order.id,
        environment: order.environment,
        type: "OrderRequested",
        at: submittedAt,
        detail: "Order request entered execution engine.",
      },
    ];
    lifecycle.push(...this.mapExecutionEvents(order, events));

    lifecycle.sort((a, b) => b.at.localeCompare(a.at));
    return lifecycle;
  }

  private mapExecutionEvents(order: OrderView, events: PolymarketExecutionEvent[]): OrderLifecycleEventDto[] {
    return events.map((event) => ({
      eventId: event.eventId,
      orderId: event.orderId ?? order.id,
      environment: event.mode,
      type: event.type,
      stateAfter: event.stateAfter,
      reason: event.reason,
      at: new Date(event.ts).toISOString(),
      detail: this.describeOrderEvent(event),
      fill: event.fill
        ? {
            price: event.fill.price,
            quantity: event.fill.quantity,
            notional: event.fill.notional,
            fee: event.fill.fee,
          }
        : undefined,
    }));
  }

  private describeOrderEvent(event: PolymarketExecutionEvent): string {
    switch (event.type) {
      case "OrderCreated":
        return "Order accepted by API and waiting for matching.";
      case "OrderAccepted":
        return "Risk checks passed and the order was accepted.";
      case "OrderEnteredBook":
        return "Order entered matching book after latency delay.";
      case "OrderPartiallyFilled":
        return "Order partially filled; remaining size stays open.";
      case "OrderFilled":
        return "Order fully filled and posted to ledger.";
      case "OrderCanceled":
        return event.reason ? `Order canceled: ${event.reason}` : "Order canceled.";
      case "OrderExpired":
        return "Order expired due to TTL/time-in-force.";
      case "OrderRejected":
        return event.reason ? `Order rejected: ${event.reason}` : "Order rejected.";
      case "MarketResolved":
        return "Market resolution event recorded.";
      case "PositionSettled":
        return "Position settled by market resolution.";
      case "SettlementApplied":
        return "Settlement cash and PnL posted to ledger.";
      default:
        return "Execution event recorded.";
    }
  }

  private captureExposureSnapshot(environment: "REAL" | "PAPER"): void {
    const rows = this.controlStore.listOrders({ env: environment, limit: 5000 });
    const byCity: Record<string, number> = {};
    const byDate: Record<string, number> = {};
    const byCorr: Record<string, number> = {};
    const total = rows.reduce((sum, item) => sum + item.amount, 0);
    if (total <= 0) {
      return;
    }
    for (const row of rows) {
      const city = row.marketId.split("_")[0] ?? "OTHER";
      const day = new Date(row.createdAt).toISOString().slice(0, 10);
      const corrBucket = `${city}_${day.slice(0, 7)}`;
      byCity[city] = (byCity[city] ?? 0) + row.amount;
      byDate[day] = (byDate[day] ?? 0) + row.amount;
      byCorr[corrBucket] = (byCorr[corrBucket] ?? 0) + row.amount;
    }

    const normalize = (data: Record<string, number>) =>
      Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Number(((v / total) * 100).toFixed(4))]));

    this.controlStore.addExposureSnapshot({
      env: environment,
      timestamp: new Date().toISOString(),
      byCity: normalize(byCity),
      byDate: normalize(byDate),
      correlationBucket: normalize(byCorr),
    });
  }

  private async findMarket(marketId: string) {
    const markets = await this.markets.getMarkets();
    const matched = markets.find((item) => item.id === marketId);
    if (!matched) {
      throw new BadRequestException("market_not_found");
    }
    return matched;
  }

  private clampPrice(value: number): number {
    return Number(Math.min(1, Math.max(0, value)).toFixed(4));
  }

  private nextOrderId(): string {
    this.orderSequence = (this.orderSequence + 1) % 46656;
    const timePart = Date.now().toString(36).toUpperCase().slice(-7).padStart(7, "0");
    const seqPart = this.orderSequence.toString(36).toUpperCase().padStart(3, "0");
    return `OD${timePart}${seqPart}`;
  }

  private buildGateway(): { gateway: ExternalVenueGateway; stub: boolean; route: "gateway" | "direct" | "stub" } {
    if (this.realExecutionRoute === "direct") {
      const host = (process.env.POLYMARKET_CLOB_HOST ?? "https://clob.polymarket.com").trim();
      const apiKey = process.env.REAL_EXECUTION_HTTP_API_KEY?.trim();
      this.logger.log(`REAL execution route=direct host=${host}`);
      return {
        gateway: new DirectPolymarketVenueGateway(host, apiKey),
        stub: false,
        route: "direct",
      };
    }

    const endpoint = process.env.REAL_EXECUTION_HTTP_ENDPOINT?.trim();
    if (!endpoint) {
      if (this.requireRealGateway) {
        this.logger.warn("REAL execution gateway endpoint not set; REAL orders will be blocked");
      } else {
        this.logger.warn("REAL execution gateway endpoint not set, fallback to stub gateway");
      }
      return { gateway: new StubExternalVenueGateway(), stub: true, route: "stub" };
    }
    this.logger.log(`REAL execution route=gateway endpoint=${endpoint}`);
    return {
      gateway: new HttpExternalVenueGateway(endpoint, process.env.REAL_EXECUTION_HTTP_API_KEY?.trim()),
      stub: false,
      route: "gateway",
    };
  }

  private resolveGatewayError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.startsWith("external_gateway_http_")) {
        return "external_gateway_unavailable";
      }
      if (error.message.startsWith("external_gateway_")) {
        return error.message;
      }
      if (error.message === "fetch_not_available") {
        return "external_gateway_fetch_unavailable";
      }
      return `external_gateway_error:${error.message}`;
    }
    return "external_gateway_error";
  }

  private async restoreStore(): Promise<void> {
    if (this.usePostgresPrimary && this.prisma) {
      const restoredFromDb = await this.restoreFromDatabase();
      if (restoredFromDb) {
        return;
      }
    }
    this.restoreFromJson();
  }

  private async restoreFromDatabase(): Promise<boolean> {
    try {
      const [orders, events, states] = await Promise.all([
        this.prisma!.execOrder.findMany({
          orderBy: { createdAt: "desc" },
          take: 5000,
        }),
        this.prisma!.execOrderEvent.findMany({
          orderBy: { at: "desc" },
          take: 50000,
        }),
        this.prisma!.execEngineState.findMany(),
      ]);
      if (orders.length === 0) {
        return false;
      }
      this.orders.splice(
        0,
        this.orders.length,
        ...orders.map((row) => ({
          id: row.id,
          strategyId: row.strategyId ?? undefined,
          walletId: row.walletId ?? undefined,
          contractName: row.contractName ?? undefined,
          marketId: row.marketId,
          side: row.side as "buy" | "sell",
          quantity: row.quantity,
          price: row.price,
          amount: row.amount,
          fee: row.fee,
          pnl: row.pnl,
          environment: row.env,
          status: row.status as OrderView["status"],
          createdAt: row.createdAt.toISOString(),
        })),
      );

      this.orderEvents.clear();
      for (const item of events) {
        const current = this.orderEvents.get(item.orderId) ?? [];
        current.push({
          eventId: item.id,
          orderId: item.orderId,
          environment: item.env,
          type: item.type,
          stateAfter: item.stateAfter ?? undefined,
          reason: item.reason ?? undefined,
          at: item.at.toISOString(),
          detail: item.detail ?? undefined,
          fill:
            item.fillJson && typeof item.fillJson === "object"
              ? ((item.fillJson as {
                  price: number;
                  quantity: number;
                  notional: number;
                  fee: number;
                }) ?? undefined)
              : undefined,
        });
        this.orderEvents.set(item.orderId, current);
      }

      for (const mode of ["PAPER", "REAL"] as const) {
        const stateRow = states.find((row) => row.env === mode);
        if (!stateRow) {
          continue;
        }
        const engine = this.getEngine(mode);
        if (this.canHydrateEngine(engine)) {
          engine.hydrate(stateRow.snapshotJson);
        }
      }
      this.logger.log(`Execution store restored from postgres: ${this.orders.length} orders`);
      return true;
    } catch (error) {
      this.logger.warn(`Execution store postgres restore failed: ${(error as Error).message}`);
      return false;
    }
  }

  private restoreFromJson(): void {
    try {
      if (!existsSync(this.storePath)) {
        return;
      }

      const raw = readFileSync(this.storePath, "utf8");
      const data = JSON.parse(raw) as {
        version?: number;
        orders?: OrderView[];
        orderEvents?: Record<string, OrderLifecycleEventDto[]>;
        snapshots?: Partial<Record<ExecutionMode, unknown>>;
        ledgers?: Partial<Record<ExecutionMode, { cash?: number }>>;
      };
      if (
        (data.version !== 1 && data.version !== 2 && data.version !== 3) ||
        !Array.isArray(data.orders)
      ) {
        this.logger.warn("Order store format invalid, skip restore");
        return;
      }

      this.orders.splice(0, this.orders.length, ...data.orders);
      this.orderEvents.clear();
      for (const [orderId, rows] of Object.entries(data.orderEvents ?? {})) {
        if (!Array.isArray(rows)) {
          continue;
        }
        this.orderEvents.set(orderId, rows.slice(0, 1000));
      }

      if (data.version === 3 && data.snapshots) {
        for (const mode of ["PAPER", "REAL"] as const) {
          const snapshot = data.snapshots[mode];
          if (!snapshot) {
            continue;
          }
          const engine = this.getEngine(mode);
          if (this.canHydrateEngine(engine)) {
            engine.hydrate(snapshot);
          }
        }
      } else if (data.ledgers) {
        for (const mode of ["PAPER", "REAL"] as const) {
          const cash = data.ledgers[mode]?.cash;
          if (typeof cash === "number" && Number.isFinite(cash)) {
            this.syncEngineCash(mode, cash);
          }
        }
      }

      this.logger.log(`Execution store restored from json: ${this.orders.length} orders`);
    } catch (error) {
      this.logger.warn(`Order store restore failed: ${(error as Error).message}`);
    }
  }

  private async persistStore(): Promise<void> {
    if (this.usePostgresPrimary && this.prisma) {
      const persistedToDb = await this.persistToDatabase();
      if (persistedToDb && !this.mirrorJsonStore) {
        return;
      }
    }
    this.persistToJson();
  }

  private async persistToDatabase(): Promise<boolean> {
    try {
      const snapshots = {
        REAL: this.getEngine("REAL").getSnapshot(),
        PAPER: this.getEngine("PAPER").getSnapshot(),
      } as const;
      const orders = this.orders.slice(0, 5000);
      const events = [...this.orderEvents.entries()]
        .flatMap(([orderId, rows]) => rows.map((row) => ({ ...row, orderId })))
        .slice(0, 50000);

      await this.prisma!.$transaction(async (tx) => {
        await tx.execOrderEvent.deleteMany();
        await tx.execFill.deleteMany();
        await tx.execSettlement.deleteMany();
        await tx.execOrder.deleteMany();

        if (orders.length > 0) {
          await tx.execOrder.createMany({
            data: orders.map((row) => ({
              id: row.id,
              env: row.environment,
              marketId: row.marketId,
              side: row.side,
              quantity: row.quantity,
              price: row.price,
              amount: row.amount,
              fee: row.fee,
              pnl: row.pnl,
              status: row.status,
              walletId: row.walletId ?? null,
              strategyId: row.strategyId ?? null,
              runId: null,
              contractName: row.contractName ?? null,
              createdAt: new Date(row.createdAt),
              updatedAt: new Date(),
            })),
          });
        }

        if (events.length > 0) {
          await tx.execOrderEvent.createMany({
            data: events.map((item) => ({
              id: item.eventId,
              orderId: item.orderId,
              env: item.environment,
              type: item.type,
              stateAfter: item.stateAfter ?? null,
              reason: item.reason ?? null,
              at: new Date(item.at),
              detail: item.detail ?? null,
              fillJson: item.fill ? this.toInputJson(item.fill) : Prisma.JsonNull,
              payloadJson: Prisma.JsonNull,
            })),
          });
        }

        for (const mode of ["PAPER", "REAL"] as const) {
          const snapshot = snapshots[mode] as {
            fills: Array<{
              id: string;
              orderId: string;
              marketId: string;
              outcomeId: string;
              side: string;
              price: number;
              quantity: number;
              notional: number;
              fee: number;
              ts: number;
            }>;
            settlements: Array<{
              marketId: string;
              ts: number;
              reason: string;
              winningOutcomeId: string | null;
              observedTemperatureC?: number;
              source?: string;
              cashDelta: number;
              settledPnlDelta: number;
            }>;
            ledger: {
              cash: number;
              reservedCash: number;
              realizedPnl: number;
              settledPnl: number;
              positions: Record<string, unknown>;
            };
          };

          if (snapshot.fills.length > 0) {
            await tx.execFill.createMany({
              data: snapshot.fills.slice(0, 50000).map((fill) => ({
                id: fill.id,
                orderId: fill.orderId,
                env: mode,
                marketId: fill.marketId,
                outcomeId: fill.outcomeId,
                side: fill.side,
                price: fill.price,
                quantity: fill.quantity,
                notional: fill.notional,
                fee: fill.fee,
                ts: new Date(fill.ts),
                rawJson: this.toInputJson(fill),
              })),
              skipDuplicates: true,
            });
          }
          if (snapshot.settlements.length > 0) {
            await tx.execSettlement.createMany({
              data: snapshot.settlements.slice(0, 50000).map((row) => ({
                env: mode,
                marketId: row.marketId,
                ts: new Date(row.ts),
                reason: row.reason,
                winningOutcomeId: row.winningOutcomeId ?? null,
                observedTemperatureC: row.observedTemperatureC ?? null,
                source: row.source ?? null,
                cashDelta: row.cashDelta,
                settledPnlDelta: row.settledPnlDelta,
                rawJson: this.toInputJson(row),
              })),
            });
          }

          await tx.execLedgerSnapshot.create({
            data: {
              env: mode,
              ts: new Date(),
              cash: snapshot.ledger.cash,
              reservedCash: snapshot.ledger.reservedCash,
              realizedPnl: snapshot.ledger.realizedPnl,
              settledPnl: snapshot.ledger.settledPnl,
              positionsJson: this.toInputJson(snapshot.ledger.positions),
            },
          });

          await tx.execEngineState.upsert({
            where: { env: mode },
            update: { snapshotJson: this.toInputJson(snapshot) },
            create: { env: mode, snapshotJson: this.toInputJson(snapshot) },
          });
        }
      });
      return true;
    } catch (error) {
      this.logger.warn(`Execution store postgres persist failed: ${(error as Error).message}`);
      return false;
    }
  }

  private persistToJson(): void {
    try {
      const payload: PersistedOrderStore = {
        version: STORE_VERSION,
        orders: this.orders.slice(0, 5000),
        orderEvents: Object.fromEntries(
          [...this.orderEvents.entries()].map(([orderId, rows]) => [orderId, rows.slice(0, 1000)]),
        ),
        snapshots: {
          REAL: this.getEngine("REAL").getSnapshot(),
          PAPER: this.getEngine("PAPER").getSnapshot(),
        },
      };

      mkdirSync(dirname(this.storePath), { recursive: true });
      writeFileSync(this.storePath, JSON.stringify(payload, null, 2), "utf8");
    } catch (error) {
      this.logger.warn(`Order store json persist failed: ${(error as Error).message}`);
    }
  }

  private getEngine(mode: ExecutionMode) {
    this.modeManager.switchMode(mode);
    return this.modeManager.getEngine(mode);
  }

  private canHydrateEngine(
    engine: ReturnType<typeof this.getEngine>,
  ): engine is ReturnType<typeof this.getEngine> & { hydrate: (snapshot: unknown) => void } {
    return typeof engine.hydrate === "function";
  }

  private syncEngineCash(mode: ExecutionMode, cash: number): void {
    const engine = this.getEngine(mode);
    if (typeof engine.syncCash === "function") {
      engine.syncCash(cash);
    }
  }

  private buildMarketQuote(market: MarketDto, ts: number) {
    const bestBid = this.clampPrice(market.bestBid ?? market.odds - 0.01);
    const bestAsk = this.clampPrice(market.bestAsk ?? market.odds + 0.01);
    const midpoint = this.clampPrice((bestBid + bestAsk) / 2);
    const depth = Math.max(50, Number((Math.max(market.oi, 1_000) / 10).toFixed(4)));
    return {
      marketId: market.id,
      ts,
      outcomes: {
        [OUTCOME_YES]: {
          outcomeId: OUTCOME_YES,
          bestBid,
          bestAsk,
          bidSize: depth,
          askSize: depth,
          midpoint,
        },
      },
    };
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}





