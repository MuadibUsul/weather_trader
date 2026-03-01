import { resolveLocalizedMarketDisplay } from "@weather-trader/shared";
import type { Market } from "@/lib/api";

export type MarketCatalogItem = {
  id: string;
  title: string;
  label: string;
  exp: string;
  bid: number;
  ask: number;
  location: string;
};

const FALLBACK_MARKETS: Market[] = [
  {
    id: "NYC_GT_85",
    title: "NYC > 85F",
    location: "New York",
    odds: 0.65,
    change24h: 12.5,
    oi: 452190,
    live: true,
    bestBid: 0.64,
    bestAsk: 0.66,
    endDate: "2024-08-24",
    source: "SEED",
  },
  {
    id: "NYC_75_85",
    title: "NYC 75-85F",
    location: "New York",
    odds: 0.32,
    change24h: -5.2,
    oi: 128400,
    live: false,
    bestBid: 0.31,
    bestAsk: 0.33,
    endDate: "2024-08-24",
    source: "SEED",
  },
  {
    id: "NYC_LT_75",
    title: "NYC < 75F",
    location: "New York",
    odds: 0.03,
    change24h: 0,
    oi: 12050,
    live: false,
    bestBid: 0.02,
    bestAsk: 0.04,
    endDate: "2024-08-24",
    source: "SEED",
  },
  {
    id: "CHI_GT_80",
    title: "CHI > 80F",
    location: "Chicago",
    odds: 0.48,
    change24h: 2.1,
    oi: 88200,
    live: false,
    bestBid: 0.47,
    bestAsk: 0.49,
    endDate: "2024-08-24",
    source: "SEED",
  },
  {
    id: "LA_GT_90",
    title: "LA > 90F",
    location: "Los Angeles",
    odds: 0.12,
    change24h: -8.4,
    oi: 32100,
    live: false,
    bestBid: 0.11,
    bestAsk: 0.13,
    endDate: "2024-08-24",
    source: "SEED",
  },
  {
    id: "LND_LT_15",
    title: "LND < 15C",
    location: "London",
    odds: 0.55,
    change24h: 1.2,
    oi: 65300,
    live: false,
    bestBid: 0.54,
    bestAsk: 0.56,
    endDate: "2024-08-24",
    source: "SEED",
  },
];

function clampPrice(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(4));
}

function toMarketDate(date?: string): Date | null {
  if (!date) {
    return null;
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function formatExp(date?: string): string {
  const parsed = toMarketDate(date);
  if (!parsed) {
    return "--";
  }

  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLabelDate(date?: string): string {
  const parsed = toMarketDate(date);
  if (!parsed) {
    return "";
  }

  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();
  return `${month}月${day}日`;
}

function shorten(text: string, max = 36): string {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1)}…`;
}

function marketToCatalogItem(market: Market): MarketCatalogItem {
  const localized = resolveLocalizedMarketDisplay({
    id: market.id,
    title: market.title,
    location: market.location,
  });

  const bid = clampPrice(market.bestBid ?? market.odds - 0.01);
  const ask = clampPrice(market.bestAsk ?? market.odds + 0.01);
  const dateLabel = formatLabelDate(market.endDate);

  return {
    id: market.id,
    title: localized.title,
    label: dateLabel ? `${shorten(localized.title)} (${dateLabel})` : shorten(localized.title),
    exp: formatExp(market.endDate),
    bid,
    ask,
    location: localized.location,
  };
}

export function marketCatalogToFallback(): Market[] {
  return FALLBACK_MARKETS;
}

export function buildMarketCatalog(markets: Market[]): MarketCatalogItem[] {
  const source = markets.length > 0 ? markets : FALLBACK_MARKETS;
  return source.map((item) => marketToCatalogItem(item));
}

export function resolveMarketItem(catalog: MarketCatalogItem[], marketId: string): MarketCatalogItem | undefined {
  return catalog.find((item) => item.id === marketId);
}

export function resolveMarketLabel(catalog: MarketCatalogItem[], marketId: string): string {
  return resolveMarketItem(catalog, marketId)?.label ?? marketId;
}

const fallbackCatalog = buildMarketCatalog(FALLBACK_MARKETS);

export const MARKET_LABEL_MAP = Object.fromEntries(
  fallbackCatalog.map((item) => [item.id, item.label]),
) as Record<string, string>;

export const MARKET_TITLE_MAP = Object.fromEntries(
  fallbackCatalog.map((item) => [item.id, item.title]),
) as Record<string, string>;
