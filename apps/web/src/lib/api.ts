import type {
  AuditLogDto,
  BindPrivateKeyWalletDto,
  DashboardSummaryDto,
  EquityPointDto,
  EnvStatusDto,
  ConfirmPluginWalletBindingDto,
  CreateOrDerivePolymarketCredentialRequestDto,
  CreateOrDerivePolymarketCredentialResponseDto,
  CredentialProfileDto,
  Environment,
  ImportPolymarketCredentialRequestDto,
  EnvironmentSwitchRequestDto,
  MarketDto,
  MarketsIntegrationConfigDto,
  OrderDto,
  OrderLifecycleEventDto,
  PluginWalletChallengeDto,
  PnlAttributionRowDto,
  RealWalletStatusDto,
  RequestPluginWalletChallengeDto,
  StrategyApprovalDto,
  SecuritySettingsDto,
  StartStrategyRequestDto,
  StrategyConfigDto,
  StrategyLeaderboardRowDto,
  StrategyProfileDto,
  StrategyRuntimeStatusDto,
  SystemStateDto,
  TopSignalDto,
  TradePinResetCodeResponseDto,
  UnbindRealWalletRequestDto,
  UpdateSecuritySettingsDto,
  WalletProfileDto,
  ExposureDto,
  HealthPanelDto,
  MarketScanItemDto,
  OrderPreviewDto,
  OrderQuoteDto,
} from "@weather-trader/shared";

export type Market = MarketDto;
export type Order = OrderDto;
export type OrderLifecycleEvent = OrderLifecycleEventDto;

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = "request_failed") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

type OrderListQuery = {
  environment?: Environment;
  status?: "filled" | "open" | "cancelled";
  limit?: number;
  page?: number;
};

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    let code = "request_failed";

    try {
      const data = JSON.parse(text) as { message?: string | string[]; error?: string };
      if (Array.isArray(data.message) && data.message.length > 0) {
        code = data.message[0] ?? code;
      } else if (typeof data.message === "string") {
        code = data.message;
      } else if (typeof data.error === "string") {
        code = data.error;
      }
    } catch {
      // ignore parse error and keep default code
    }

    throw new ApiError(code, res.status, code);
  }

  return (await res.json()) as T;
}

export function getMarkets() {
  return request<Market[]>("/markets");
}

export function getMarketsIntegrationConfig() {
  return request<MarketsIntegrationConfigDto>("/markets/integration");
}

export function updateMarketsIntegrationConfig(payload: Partial<MarketsIntegrationConfigDto>) {
  return request<MarketsIntegrationConfigDto>("/markets/integration", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getSystemState() {
  return request<SystemStateDto>("/system/state");
}

export function switchEnvironment(payload: EnvironmentSwitchRequestDto) {
  return request<SystemStateDto>("/system/environment/switch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateWalletProfile(environment: Environment, payload: WalletProfileDto) {
  return request<SystemStateDto>(`/system/profiles/${environment}/wallet`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function requestRealWalletPluginChallenge(payload: RequestPluginWalletChallengeDto) {
  return request<PluginWalletChallengeDto>("/system/wallet/real/plugin/challenge", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function confirmRealWalletPluginBinding(payload: ConfirmPluginWalletBindingDto) {
  return request<SystemStateDto>("/system/wallet/real/plugin/confirm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function bindRealWalletPrivateKey(payload: BindPrivateKeyWalletDto) {
  return request<SystemStateDto>("/system/wallet/real/private-key/bind", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRealWalletStatus() {
  return request<RealWalletStatusDto>("/system/wallet/real/status");
}

export function unbindRealWallet(payload?: UnbindRealWalletRequestDto) {
  return request<SystemStateDto>("/system/wallet/real/unbind", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function updateCredentialProfile(payload: CredentialProfileDto) {
  return request<SystemStateDto>("/system/credential", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function createOrDerivePolymarketCredential(payload: CreateOrDerivePolymarketCredentialRequestDto) {
  return request<CreateOrDerivePolymarketCredentialResponseDto>("/system/credential/polymarket/create-or-derive", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function importPolymarketCredential(payload: ImportPolymarketCredentialRequestDto) {
  return request<SystemStateDto>("/system/credential/polymarket/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getSecuritySettings() {
  return request<SecuritySettingsDto>("/system/security");
}

export function updateSecuritySettings(payload: UpdateSecuritySettingsDto) {
  return request<SystemStateDto>("/system/security", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function requestTradePinResetCode() {
  return request<TradePinResetCodeResponseDto>("/system/security/trade-pin/code", {
    method: "POST",
  });
}

export function getAuditLogs(limit = 50) {
  return request<AuditLogDto[]>(`/system/audit${toQuery({ limit })}`);
}

export function getOrders(query?: OrderListQuery) {
  return request<Order[]>(`/orders${toQuery(query ?? {})}`);
}

export function getOpenOrders(params?: { environment?: Environment; limit?: number }) {
  return request<Order[]>(`/orders/open${toQuery(params ?? {})}`);
}

export type WalletSnapshotDto = {
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

export function getWalletSnapshot(params?: { environment?: Environment }) {
  return request<WalletSnapshotDto>(`/orders/wallet-snapshot${toQuery(params ?? {})}`);
}

export function cancelOrder(orderId: string, payload?: { reason?: string }) {
  return request<Order>(`/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export type ExecutionHealthDto = {
  route: {
    configured: string;
    resolved: "gateway" | "direct" | "stub";
    ready: boolean;
  };
  persistence: {
    enabled: boolean;
    backend: string;
    postgresPrimary: boolean;
    mirrorJson: boolean;
  };
};

export function getExecutionHealth() {
  return request<ExecutionHealthDto>("/orders/execution-health");
}

export function getOrderLifecycleEvents(orderId: string, limit = 100) {
  return request<OrderLifecycleEvent[]>(`/orders/${encodeURIComponent(orderId)}/events${toQuery({ limit })}`);
}

export function createOrder(payload: {
  marketId: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  environment?: Environment;
  strategyId?: string;
  runId?: string;
  walletId?: string;
  orderType?: "limit" | "market";
  slippageBps?: number;
}) {
  return request<Order>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getOrderQuote(params: { marketId: string; environment?: Environment }) {
  return request<OrderQuoteDto>(`/orders/quote${toQuery(params)}`);
}

export function previewOrder(payload: {
  marketId: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  environment?: Environment;
  strategyId?: string;
  slippageBps?: number;
}) {
  return request<OrderPreviewDto>("/orders/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getStrategy() {
  return request<StrategyConfigDto>("/strategy");
}

export function updateStrategy(payload: StrategyConfigDto) {
  return request<StrategyConfigDto>("/strategy", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getStrategyRuntime() {
  return request<StrategyRuntimeStatusDto>("/strategy/runtime");
}

export function startStrategy(payload?: StartStrategyRequestDto) {
  return request<StrategyRuntimeStatusDto>("/strategy/start", {
    method: "POST",
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
}

export function stopStrategy() {
  return request<StrategyRuntimeStatusDto>("/strategy/stop", {
    method: "POST",
  });
}

export function getDashboardSummary(params: { env: Environment; range: "1D" | "7D" | "30D" | "ALL" }) {
  return request<DashboardSummaryDto>(`/api/dashboard/summary${toQuery(params)}`);
}

export function getEquityCurve(params: { range: "1D" | "7D" | "30D" | "ALL"; compare?: "paper" | "real" }) {
  return request<EquityPointDto[]>(`/api/dashboard/equity_curve${toQuery(params)}`);
}

export function getStrategyLeaderboard(params: { env: Environment; range: "1D" | "7D" | "30D" | "ALL" }) {
  return request<StrategyLeaderboardRowDto[]>(`/api/dashboard/strategy_leaderboard${toQuery(params)}`);
}

export function getExposurePanel(params: { env: Environment; range: "1D" | "7D" | "30D" | "ALL" }) {
  return request<ExposureDto>(`/api/dashboard/exposures${toQuery(params)}`);
}

export function getHealthPanel(params: {
  env: Environment;
  range: "1D" | "7D" | "30D" | "ALL";
  strategy_id?: string;
}) {
  return request<HealthPanelDto>(`/api/dashboard/health${toQuery(params)}`);
}

export function getTopSignals(params: { env: Environment; limit?: number }) {
  return request<TopSignalDto[]>(`/api/dashboard/top_signals${toQuery(params)}`);
}

export function listStrategies() {
  return request<StrategyProfileDto[]>("/api/strategies");
}

export function listStrategyApprovals(strategyId: string) {
  return request<StrategyApprovalDto[]>(`/api/strategies/${strategyId}/approvals`);
}

export function requestStrategyReal(strategyId: string, payload: { reason: string }) {
  return request<StrategyProfileDto>(`/api/strategies/${strategyId}/request_real`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function approveStrategyReal(
  strategyId: string,
  payload: {
    riskLimits: {
      maxDailyLoss: number;
      maxPositionSize: number;
      maxOpenPositions: number;
      maxSlippageBps: number;
    };
    initialAllocationPct: number;
  },
) {
  return request<StrategyProfileDto>(`/api/strategies/${strategyId}/approve_real`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function rejectStrategyReal(strategyId: string, payload: { reason: string }) {
  return request<StrategyProfileDto>(`/api/strategies/${strategyId}/reject_real`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getEnvStatus(target: Environment = "REAL") {
  return request<EnvStatusDto>(`/api/env/status${toQuery({ target })}`);
}

export function getMarketScan(params: {
  env: Environment;
  city?: string;
  filters?: string;
  sort?: "deviation" | "liquidity" | "slippage";
}) {
  return request<MarketScanItemDto[]>(`/api/market_scan${toQuery(params)}`);
}

export function getPnlAttribution(params: {
  env: Environment;
  range: "1D" | "7D" | "30D" | "ALL";
  group_by: "strategy" | "city" | "date";
}) {
  return request<PnlAttributionRowDto[]>(`/api/analytics/pnl_attribution${toQuery(params)}`);
}

export type WeatherPaperTradingMetricsDto = {
  totalReturn: number;
  maxDrawdownPct: number;
  sharpe: number;
  sortino: number;
  winRatePct: number;
  profitFactor: number;
  expectancy: number;
  turnover: number;
  avgHoldingMinutes: number;
  feeRatioPct: number;
};

export type WeatherPaperForecastMetricsDto = {
  brierScore: number;
  logLoss: number;
  sharpness: number;
  horizonBreakdown: Array<{
    bucket: "T-7+" | "T-3~7" | "T-1~3" | "T-0~1";
    brier: number;
    count: number;
  }>;
};

export type WeatherPaperResearchReportDto = {
  generatedAt: string;
  summary: {
    mode: "PAPER" | "REAL";
    totalOrders: number;
    totalFills: number;
    totalSettlements: number;
  };
  tradingMetrics: WeatherPaperTradingMetricsDto;
  forecastMetrics: WeatherPaperForecastMetricsDto;
  decomposition: {
    byMarket: Array<{ key: string; pnl: number; trades: number }>;
    byCity: Array<{ key: string; pnl: number; trades: number }>;
    byDate: Array<{ key: string; pnl: number; trades: number }>;
  };
  robustness: {
    feeStress: Array<{ feeMultiplier: number; projectedReturn: number }>;
    slippageStress: Array<{ extraSlippageBps: number; projectedReturn: number }>;
    reconciliation: {
      ledgerSettledPnl: number;
      settlementsSum: number;
      diff: number;
    };
  };
};

export type WeatherPaperReportDto = {
  modelVariant?: "deterministic_l2" | "stochastic_impact";
  report: WeatherPaperResearchReportDto;
  forecastEval: Array<{
    marketId: string;
    outcomeId: string;
    forecastTs: number;
    resolveTs: number;
    probability: number;
    source: string;
    observed: 0 | 1;
    marketImpliedProbability: number;
  }>;
  snapshot: {
    mode: "PAPER" | "REAL";
    orders: Array<Record<string, unknown>>;
    fills: Array<Record<string, unknown>>;
    settlements: Array<Record<string, unknown>>;
    ledger: {
      cash: number;
      reservedCash: number;
      realizedPnl: number;
      settledPnl: number;
      positions: Record<string, unknown>;
    };
  };
  auditJsonl: string;
  sourceMeta: Record<string, unknown>;
  executionConfig: {
    latencyMs: number;
    maxFillRatioPerTick: number;
    spreadSlippageK: number;
    impactBps: number;
    tradingFeeRate: number;
    seed?: number;
  };
  realEligibility: {
    eligibleForReal: boolean;
    checks: {
      positiveReturn: boolean;
      drawdownOk: boolean;
      brierOk: boolean;
      minTrades: boolean;
    };
  };
  variants?: Record<
    "deterministic_l2" | "stochastic_impact",
    {
      report: WeatherPaperResearchReportDto;
      forecastEval: WeatherPaperReportDto["forecastEval"];
      snapshot: WeatherPaperReportDto["snapshot"];
      auditJsonl: string;
      realEligibility: WeatherPaperReportDto["realEligibility"];
    }
  >;
  sensitivityDelta?: {
    totalReturnDelta: number;
    brierDelta: number;
  } | null;
};

export function runWeatherPaperBacktest(payload?: {
  initialCash?: number;
  feeRate?: number;
  slippageBps?: number;
  matchingModel?: "mid" | "depth";
  paperModel?: "deterministic_l2" | "stochastic_impact" | "both";
  seed?: number;
  edgeThreshold?: number;
  minConfidence?: number;
  orderNotional?: number;
  marketLimit?: number;
  fidelitySec?: number;
  syntheticSpread?: number;
  syntheticDepth?: number;
}) {
  return request<WeatherPaperReportDto>("/backtest/weather-paper", {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}
