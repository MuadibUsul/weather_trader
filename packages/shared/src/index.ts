export type Environment = "REAL" | "PAPER";

export type MarketDto = {
  id: string;
  title: string;
  location: string;
  odds: number;
  change24h: number;
  oi: number;
  live: boolean;
};

export type OrderDto = {
  id: string;
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

export type StrategyConfigDto = {
  model: "mean_reversion" | "trend_following";
  autoTradeEnabled: boolean;
  triggerThreshold: number;
  updateFrequencySec: number;
  maxDailyLoss: number;
  maxPositionSize: number;
  maxOpenPositions: number;
  slippageBps: number;
};
