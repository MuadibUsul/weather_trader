export type ExecutionMode = "PAPER" | "REAL";
export type OrderSide = "BUY" | "SELL";
export type OrderType = "LIMIT" | "MARKET";
export type TimeInForce = "GTC" | "IOC" | "FOK" | "TTL";

export type MarketType = "BINARY" | "MULTI_OUTCOME";

export type MarketStatus = "OPEN" | "CLOSED" | "RESOLVED" | "CANCELED";

export type SettlementReason = "RESOLVED" | "CANCELED";

export type WeatherMarket = {
  id: string;
  title: string;
  city: string;
  marketType: MarketType;
  closeTimeMs: number;
  resolveTimeMs: number;
  status: MarketStatus;
  outcomes: WeatherOutcome[];
};

export type WeatherOutcome = {
  id: string;
  label: string;
  thresholdC?: number;
  rangeMinC?: number;
  rangeMaxC?: number;
};

export type OutcomeQuote = {
  outcomeId: string;
  bestBid: number;
  bestAsk: number;
  bidSize: number;
  askSize: number;
  midpoint: number;
};

export type MarketQuote = {
  marketId: string;
  ts: number;
  outcomes: Record<string, OutcomeQuote>;
};

export type OrderRequest = {
  id?: string;
  marketId: string;
  outcomeId: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  tif?: TimeInForce;
  createdAtMs: number;
  expiresAtMs?: number;
  strategyId?: string;
  runId?: string;
  tags?: Record<string, string>;
};

export type OrderStatus =
  | "PENDING_NEW"
  | "ACCEPTED"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "CANCELED"
  | "EXPIRED"
  | "REJECTED";

export type OrderRecord = {
  id: string;
  mode: ExecutionMode;
  marketId: string;
  outcomeId: string;
  side: OrderSide;
  type: OrderType;
  tif: TimeInForce;
  quantity: number;
  limitPrice: number | null;
  status: OrderStatus;
  filledQuantity: number;
  remainingQuantity: number;
  averageFillPrice: number;
  totalFee: number;
  createdAtMs: number;
  enterBookAtMs: number;
  enteredBookAtMs: number | null;
  updatedAtMs: number;
  expiresAtMs: number | null;
  externalOrderId: string | null;
  rejectReason?: string;
  strategyId?: string;
  runId?: string;
  tags?: Record<string, string>;
};

export type FillRecord = {
  id: string;
  orderId: string;
  mode: ExecutionMode;
  marketId: string;
  outcomeId: string;
  side: OrderSide;
  price: number;
  quantity: number;
  notional: number;
  fee: number;
  ts: number;
  bookPrice?: number;
  spreadAdj?: number;
  impactAdj?: number;
  latencyMs?: number;
  grossAmount?: number;
  netAmount?: number;
  feeBreakdown?: {
    tradingFee: number;
    fixedFee: number;
    networkCost: number;
    totalFee: number;
  };
};

export type Position = {
  marketId: string;
  outcomeId: string;
  quantity: number;
  averageCost: number;
  realizedPnl: number;
  unsettledCost: number;
};

export type LedgerSnapshot = {
  cash: number;
  reservedCash: number;
  realizedPnl: number;
  settledPnl: number;
  positions: Record<string, Position>;
};

export type RiskLimits = {
  maxNotionalPerOrder: number;
  maxPositionPerOutcome: number;
  maxExposurePerMarket: number;
  maxOpenOrders: number;
  maxDailyLoss: number;
};

export type RiskCheckInput = {
  request: OrderRequest;
  quote: MarketQuote;
  ledger: LedgerSnapshot;
  openOrders: number;
  marketExposure: number;
  realizedLossToday: number;
};

export type RiskDecision = {
  ok: boolean;
  reason?: string;
};

export type MarketSettlement = {
  marketId: string;
  ts: number;
  reason: SettlementReason;
  winningOutcomeId: string | null;
  observedTemperatureC?: number;
  source?: string;
};

export type SettlementRecord = {
  marketId: string;
  ts: number;
  reason: SettlementReason;
  winningOutcomeId: string | null;
  observedTemperatureC?: number;
  source?: string;
  cashDelta: number;
  settledPnlDelta: number;
};

export type ForecastPoint = {
  marketId: string;
  outcomeId: string;
  forecastTs: number;
  resolveTs: number;
  probability: number;
  source: string;
};

export type ForecastEvaluationPoint = ForecastPoint & {
  observed: 0 | 1;
  marketImpliedProbability: number;
};

export type ExecutionEventType =
  | "OrderCreated"
  | "OrderAccepted"
  | "OrderEnteredBook"
  | "OrderPartiallyFilled"
  | "OrderFilled"
  | "OrderCanceled"
  | "OrderExpired"
  | "OrderRejected"
  | "SettlementApplied"
  | "MarketResolved"
  | "PositionSettled";

export type ExecutionEvent = {
  eventId: string;
  mode: ExecutionMode;
  type: ExecutionEventType;
  ts: number;
  orderId?: string;
  marketId?: string;
  outcomeId?: string;
  stateAfter?: OrderStatus;
  fill?: FillRecord;
  settlement?: SettlementRecord;
  reason?: string;
  externalOrderId?: string;
  causationId?: string;
  payload?: Record<string, unknown>;
};

export type ExecutionResult = {
  order: OrderRecord;
  fills: FillRecord[];
  events: ExecutionEvent[];
  ledger: LedgerSnapshot;
};

export type CancelResult = {
  order: OrderRecord;
  events: ExecutionEvent[];
};

export type SettlementResult = {
  settlement: SettlementRecord;
  events: ExecutionEvent[];
  ledger: LedgerSnapshot;
};

export type ExecutionSnapshot = {
  mode: ExecutionMode;
  orders: OrderRecord[];
  fills: FillRecord[];
  settlements: SettlementRecord[];
  ledger: LedgerSnapshot;
};

export type ExecutionEngine = {
  readonly mode: ExecutionMode;
  syncCash?(cash: number): void;
  submit(request: OrderRequest, quote: MarketQuote): Promise<ExecutionResult>;
  onMarketDataTick(quote: MarketQuote): Promise<ExecutionEvent[]>;
  onTime(nowTs: number): Promise<ExecutionEvent[]>;
  onResolution(settlement: MarketSettlement): Promise<SettlementResult>;
  processQuote(quote: MarketQuote): Promise<ExecutionEvent[]>;
  cancelOrder(orderId: string, ts: number, reason?: string): Promise<CancelResult>;
  expireOrders(nowTs: number): Promise<ExecutionEvent[]>;
  settle(settlement: MarketSettlement): Promise<SettlementResult>;
  getSnapshot(): ExecutionSnapshot;
  listEvents(limit?: number): ExecutionEvent[];
  hydrate?(snapshot: ExecutionSnapshot, events?: ExecutionEvent[]): void;
};

export type ExecutionFactoryConfig = {
  feeRate: number;
  slippageBps: number;
  chainCostPerFill: number;
  risk: RiskLimits;
  latencyMs?: number;
  maxFillRatioPerTick?: number;
  spreadSlippageK?: number;
  impactBps?: number;
  fixedFee?: number;
  networkCost?: number;
  allowTradeAfterClose?: boolean;
};
