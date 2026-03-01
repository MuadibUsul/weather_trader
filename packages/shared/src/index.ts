export type Environment = "REAL" | "PAPER";

export type MarketDto = {
  id: string;
  title: string;
  location: string;
  odds: number;
  change24h: number;
  oi: number;
  live: boolean;
  bestBid?: number;
  bestAsk?: number;
  endDate?: string;
  source?: "EXCHANGE" | "DATABASE" | "SEED";
};

export type MarketsIntegrationConfigDto = {
  exchangeUrl: string;
  tagSlug: string;
  limit: number;
  timeoutMs: number;
};

export type OrderDto = {
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
  environment: Environment;
  status: "filled" | "open" | "cancelled";
  createdAt: string;
};

export type OrderLifecycleEventDto = {
  eventId: string;
  orderId: string;
  environment: Environment;
  type: string;
  stateAfter?: string;
  reason?: string;
  at: string;
  detail?: string;
  fill?: {
    price: number;
    quantity: number;
    notional: number;
    fee: number;
  };
};

export type OrderQuoteDto = {
  marketId: string;
  bestBid: number;
  bestAsk: number;
  midPrice: number;
  spreadBps: number;
  source: "EXCHANGE" | "DATABASE" | "SEED";
  updatedAt: string;
};

export type OrderPreviewDto = {
  marketId: string;
  environment: Environment;
  side: "buy" | "sell";
  requestedPrice: number;
  suggestedPrice: number;
  quantity: number;
  finalQuantity: number;
  notional: number;
  estimatedFee: number;
  estimatedSlippageBps: number;
  estimatedFillPrice: number;
  risk: {
    pass: boolean;
    reason?: string;
  };
};

export type StrategyConfigDto = {
  strategyId?: string;
  model: "mean_reversion" | "trend_following";
  autoTradeEnabled: boolean;
  triggerThreshold: number;
  updateFrequencySec: number;
  maxDailyLoss: number;
  maxPositionSize: number;
  maxOpenPositions: number;
  slippageBps: number;
};

export type StrategySignalPreviewDto = {
  marketId: string;
  side: "buy" | "sell";
  model: StrategyConfigDto["model"];
  confidence: number;
  odds: number;
  change24h: number;
  reason: string;
  quantity: number;
  createdAt: string;
};

export type StrategyRuntimeStatusDto = {
  running: boolean;
  environment: Environment | null;
  activeStrategyId: string | null;
  activeWalletId: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  lastTickAt: string | null;
  nextTickAt: string | null;
  ticks: number;
  signals: number;
  executedOrders: number;
  rejectedOrders: number;
  sessionPnl: number;
  lastSignal: StrategySignalPreviewDto | null;
  lastError: string | null;
};

export type StartStrategyRequestDto = {
  strategyId?: string;
  walletId?: string;
};

export type WalletProfileDto = {
  label: string;
  address: string;
  balance: number;
  unit: string;
  connected: boolean;
  isSimulated: boolean;
  bindingMethod?: "SIMULATED" | "PLUGIN_SIGNATURE" | "PRIVATE_KEY" | "MANUAL";
  boundAt?: string | null;
};

export type RealWalletStatusDto = {
  wallet: WalletProfileDto;
  checks: {
    walletConnected: boolean;
    addressFormat: boolean;
    credentialHealthy: boolean;
    gatewayReady: boolean;
  };
  ready: boolean;
  warnings: string[];
  updatedAt: string;
};

export type UnbindRealWalletRequestDto = {
  reason?: string;
};

export type CredentialProfileDto = {
  keyName: string;
  healthy: boolean;
  lastHeartbeat: string;
  scope: string;
  provider?: "POLYMARKET";
  host?: string;
  chainId?: number;
  signatureType?: 0 | 1 | 2;
  funder?: string;
  walletAddress?: string;
  apiKey?: string;
  secretMasked?: string;
  passphraseMasked?: string;
  encryptedStored?: boolean;
  lastDerivedAt?: string | null;
};

export type CreateOrDerivePolymarketCredentialRequestDto = {
  host: string;
  chainId: number;
  signatureType: 0 | 1 | 2;
  funder: string;
  privateKey: string;
};

export type CreateOrDerivePolymarketCredentialResponseDto = {
  state: SystemStateDto;
  apiKey: string;
  secret: string;
  passphrase: string;
  walletAddress: string;
};

export type ImportPolymarketCredentialRequestDto = {
  host: string;
  chainId: number;
  signatureType: 0 | 1 | 2;
  funder: string;
  walletAddress: string;
  apiKey: string;
  secret: string;
  passphrase: string;
};

export type EnvironmentProfileDto = {
  executionLabel: string;
  purpose: string;
  riskHint: string;
  wallet: WalletProfileDto;
  credential: CredentialProfileDto;
};

export type RuntimeGatewayStatusDto = {
  source: string;
  latencyMs: number | null;
  status: "ok" | "degraded" | "down";
  lastCheckedAt: string | null;
};

export type RuntimeOracleStatusDto = {
  source: string;
  delaySec: number | null;
  status: "fresh" | "stale" | "down";
  lastSyncedAt: string | null;
};

export type RuntimeStatusDto = {
  polymarketGateway: RuntimeGatewayStatusDto;
  oracle: RuntimeOracleStatusDto;
};

export type SecuritySettingsDto = {
  mfaEnabled: boolean;
  tradePinSet: boolean;
  updatedAt: string;
};

export type SystemStateDto = {
  environment: Environment;
  profiles: Record<Environment, EnvironmentProfileDto>;
  runtime: RuntimeStatusDto;
  security: SecuritySettingsDto;
};

export type EnvironmentSwitchRequestDto = {
  target: Environment;
  pin: string;
  acknowledged: boolean;
};

export type AuditLogDto = {
  id: string;
  ts: string;
  action: string;
  status: "SUCCESS" | "FAILED";
  detail: string;
  environment: Environment;
};

export type UpdateSecuritySettingsDto = {
  mfaEnabled: boolean;
  newTradePin?: string;
  emailCode?: string;
};

export type TradePinResetCodeResponseDto = {
  destination: string;
  expiresAt: string;
  debugCode?: string;
};

export type RequestPluginWalletChallengeDto = {
  address: string;
};

export type PluginWalletChallengeDto = {
  address: string;
  message: string;
  expiresAt: string;
};

export type ConfirmPluginWalletBindingDto = {
  address: string;
  signature: string;
};

export type BindPrivateKeyWalletDto = {
  privateKey: string;
};

export type StrategyLifecycleStatus =
  | "dev"
  | "paper_testing"
  | "eligible"
  | "real_requested"
  | "real_approved"
  | "real_small"
  | "real_scaled"
  | "frozen";

export type StrategyProfileDto = {
  id: string;
  name: string;
  version: number;
  status: StrategyLifecycleStatus;
  createdAt: string;
  updatedAt: string;
};

export type StrategyApprovalDto = {
  id: string;
  strategyId: string;
  requestedBy: string;
  approvedBy?: string | null;
  status: "requested" | "approved" | "rejected";
  payload: Record<string, unknown>;
  createdAt: string;
};

export type DashboardSummaryDto = {
  env: Environment;
  range: "1D" | "7D" | "30D" | "ALL";
  totalEquity: number;
  availableCash: number;
  deployedCapital: number;
  pnl1d: number;
  pnl7d: number;
  pnl30d: number;
  maxDrawdown: number;
  sharpe: number;
  winRate: number;
  profitFactor: number;
  riskStatus: "safe" | "watch" | "danger";
  bestStrategyId?: string;
};

export type EquityPointDto = {
  ts: string;
  paperEquity?: number;
  realEquity?: number;
};

export type StrategyLeaderboardRowDto = {
  strategyId: string;
  strategyName: string;
  status: StrategyLifecycleStatus;
  return7d: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  capitalUsage: number;
  grade: "A" | "B" | "C";
  canRequestReal: boolean;
};

export type ExposureDto = {
  city: Array<{ name: string; value: number }>;
  date: Array<{ key: string; value: number }>;
  correlationBuckets: Array<{ bucket: string; value: number }>;
  tailRisk: Array<{ level: "info" | "warning" | "critical"; message: string }>;
};

export type HealthPanelDto = {
  signalWinRate50: number;
  signalLatencyMsP95: number;
  avgSlippageBps: number;
  orderRejectRate: number;
  apiErrorRate: number;
  apiTimeoutRate: number;
};

export type TopSignalDto = {
  signalId: string;
  strategyId: string;
  marketId: string;
  side: "long" | "short";
  modelProb: number;
  marketProb: number;
  edge: number;
  confidence: number;
  recommendedSize: number;
  liquidityScore: number;
  expectedSlippageBps: number;
  riskAdjustedScore: number;
  createdAt: string;
};

export type DashboardErrorDto = {
  code: string;
  message: string;
};

export type EnvStatusDto = {
  realReady: boolean;
  reasons: string[];
};

export type RequestRealDto = {
  reason: string;
};

export type ApproveRealDto = {
  riskLimits: {
    maxDailyLoss: number;
    maxPositionSize: number;
    maxOpenPositions: number;
    maxSlippageBps: number;
  };
  initialAllocationPct: number;
};

export type RejectRealDto = {
  reason: string;
};

export type AllocationSnapshotDto = {
  strategyId: string;
  env: Environment;
  allocationPct: number;
  timestamp: string;
  reason: Record<string, unknown>;
};

export type MarketScanItemDto = {
  marketId: string;
  title: string;
  location: string;
  endDate?: string;
  modelProb: number;
  marketImpliedProb: number;
  deviation: number;
  bestBid: number;
  bestAsk: number;
  spreadBps: number;
  estimatedSlippageBps: number;
  impactCost: number;
  liquidityScore: number;
};

export type PnlAttributionRowDto = {
  key: string;
  realizedPnl: number;
  wins: number;
  losses: number;
  winRate: number;
  fees: number;
  slippageLoss: number;
  fillRate: number;
  edgeContribution: number;
  rejectLoss: number;
};

export * from "./market-localization";
