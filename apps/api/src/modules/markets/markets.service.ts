import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveLocalizedMarketDisplay, type MarketDto } from "@weather-trader/shared";
import { PrismaService } from "../../prisma.service";

type GammaEvent = {
  title?: unknown;
  endDate?: unknown;
  openInterest?: unknown;
};

type GammaTaggedEvent = {
  title?: unknown;
  endDate?: unknown;
  openInterest?: unknown;
  markets?: unknown;
};

type GammaMarket = {
  id?: unknown;
  conditionId?: unknown;
  slug?: unknown;
  question?: unknown;
  active?: unknown;
  closed?: unknown;
  archived?: unknown;
  acceptingOrders?: unknown;
  bestBid?: unknown;
  bestAsk?: unknown;
  outcomePrices?: unknown;
  oneDayPriceChange?: unknown;
  liquidityNum?: unknown;
  liquidityClob?: unknown;
  liquidity?: unknown;
  volume24hr?: unknown;
  endDate?: unknown;
  endDateIso?: unknown;
  events?: GammaEvent[];
};

type MarketRow = {
  symbol: string;
  title: string;
  location: string;
  odds: number;
  change24h: number;
  oi: number;
  live: boolean;
};

type MarketsIntegrationConfig = {
  exchangeUrl: string;
  tagSlug: string;
  limit: number;
  timeoutMs: number;
};

const execFileAsync = promisify(execFile);

const LOCATION_RULES: Array<{ pattern: RegExp; location: string }> = [
  { pattern: /\bNYC\b|New York/i, location: "New York" },
  { pattern: /\bCHI\b|Chicago/i, location: "Chicago" },
  { pattern: /\bLA\b|Los Angeles/i, location: "Los Angeles" },
  { pattern: /\bLND\b|London/i, location: "London" },
  { pattern: /\bSeoul\b/i, location: "Seoul" },
  { pattern: /\bAtlanta\b/i, location: "Atlanta" },
  { pattern: /\bSeattle\b/i, location: "Seattle" },
  { pattern: /\bToronto\b/i, location: "Toronto" },
  { pattern: /\bBuenos Aires\b/i, location: "Buenos Aires" },
  { pattern: /\bSao Paulo\b/i, location: "Sao Paulo" },
  { pattern: /\bSF\b|San Francisco/i, location: "San Francisco" },
  { pattern: /\bMiami\b/i, location: "Miami" },
  { pattern: /\bParis\b/i, location: "Paris" },
  { pattern: /\bTokyo\b/i, location: "Tokyo" },
];

const seed: MarketDto[] = [
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

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (lowered === "true") {
      return true;
    }
    if (lowered === "false") {
      return false;
    }
  }

  return fallback;
}

function clampPrice(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.min(1, Math.max(0, value));
  return Number(normalized.toFixed(4));
}

function parseOutcomePrices(raw: unknown): number[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => toNumber(item)).filter((item): item is number => item !== null);
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.map((item) => toNumber(item)).filter((item): item is number => item !== null);
    } catch {
      return [];
    }
  }

  return [];
}

function toPercentDelta(raw: unknown): number {
  const delta = toNumber(raw);
  if (delta === null) {
    return 0;
  }

  const scaled = Math.abs(delta) <= 1 ? delta * 100 : delta;
  return Number(scaled.toFixed(2));
}

function pickLocation(texts: Array<string | null | undefined>): string {
  for (const text of texts) {
    if (!text) {
      continue;
    }

    const matched = LOCATION_RULES.find((rule) => rule.pattern.test(text));
    if (matched) {
      return matched.location;
    }
  }

  return "Polymarket";
}

function normalizeLegacyMarket(row: {
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
  source?: MarketDto["source"];
}): MarketDto {
  const localized = resolveLocalizedMarketDisplay({
    id: row.id,
    title: row.title,
    location: row.location,
  });

  const bid = clampPrice(row.bestBid ?? row.odds - 0.01);
  const ask = clampPrice(row.bestAsk ?? row.odds + 0.01);

  return {
    id: row.id,
    title: localized.title,
    location: localized.location,
    odds: clampPrice(row.odds) ?? 0.5,
    change24h: Number(row.change24h.toFixed(2)),
    oi: Math.max(0, Number(row.oi.toFixed(2))),
    live: row.live,
    bestBid: bid ?? undefined,
    bestAsk: ask ?? undefined,
    endDate: row.endDate,
    source: row.source ?? "SEED",
  };
}

function mapGammaMarket(raw: GammaMarket): MarketDto | null {
  const idCandidate = raw.conditionId ?? raw.id ?? raw.slug;
  const id = typeof idCandidate === "string" || typeof idCandidate === "number" ? String(idCandidate) : "";
  if (!id) {
    return null;
  }

  const title = typeof raw.question === "string" && raw.question.trim().length > 0
    ? raw.question.trim()
    : typeof raw.slug === "string" && raw.slug.trim().length > 0
      ? raw.slug.trim().replace(/-/g, " ")
      : id;

  const firstEvent = Array.isArray(raw.events) && raw.events.length > 0 ? raw.events[0] : undefined;
  const location = pickLocation([
    title,
    typeof firstEvent?.title === "string" ? firstEvent.title : null,
  ]);

  const localized = resolveLocalizedMarketDisplay({
    id,
    title,
    location,
  });

  const bestBid = clampPrice(toNumber(raw.bestBid));
  const bestAsk = clampPrice(toNumber(raw.bestAsk));
  const outcomePrices = parseOutcomePrices(raw.outcomePrices);
  const yesPrice = clampPrice(outcomePrices[0] ?? null);
  const odds = bestAsk ?? yesPrice ?? bestBid ?? 0.5;

  const oi =
    toNumber(raw.liquidityNum) ??
    toNumber(raw.liquidityClob) ??
    toNumber(raw.liquidity) ??
    toNumber(firstEvent?.openInterest) ??
    toNumber(raw.volume24hr) ??
    0;

  const endDate =
    (typeof raw.endDate === "string" && raw.endDate) ||
    (typeof firstEvent?.endDate === "string" && firstEvent.endDate) ||
    (typeof raw.endDateIso === "string" && raw.endDateIso) ||
    undefined;

  const live =
    toBoolean(raw.active, true) &&
    !toBoolean(raw.closed, false) &&
    !toBoolean(raw.archived, false) &&
    toBoolean(raw.acceptingOrders, true);

  return {
    id,
    title: localized.title,
    location: localized.location,
    odds,
    change24h: toPercentDelta(raw.oneDayPriceChange),
    oi: Math.max(0, Number(oi.toFixed(2))),
    live,
    bestBid: bestBid ?? undefined,
    bestAsk: bestAsk ?? undefined,
    endDate,
    source: "EXCHANGE",
  };
}

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);
  private readonly configPath = resolve(process.cwd(), process.env.MARKETS_CONFIG_PATH ?? "runtime/markets-config.json");
  private integrationConfig: MarketsIntegrationConfig = {
    exchangeUrl: process.env.POLYMARKET_MARKETS_URL ?? "https://gamma-api.polymarket.com/events",
    tagSlug: process.env.POLYMARKET_MARKETS_TAG_SLUG ?? "weather",
    limit: Math.max(6, Math.min(200, Number(process.env.POLYMARKET_MARKETS_LIMIT ?? 60))),
    timeoutMs: Math.max(1000, Math.min(30000, Number(process.env.POLYMARKET_MARKETS_TIMEOUT_MS ?? 2200))),
  };
  private readonly cacheTtlSec = Math.max(2, Math.min(60, Number(process.env.POLYMARKET_MARKETS_CACHE_SEC ?? 8)));
  private readonly enableDatabaseFallback = process.env.MARKETS_ENABLE_DB_FALLBACK === "true";
  private readonly allowSeedFallback = process.env.POLYMARKET_ALLOW_SEED_FALLBACK !== "false";
  private readonly enablePowerShellFallback =
    process.platform === "win32" && process.env.POLYMARKET_MARKETS_POWERSHELL_FALLBACK === "true";
  private memoryCache: { data: MarketDto[]; expiresAt: number } | null = null;
  private lastExchangeWarnAt = 0;
  private refreshPromise: Promise<MarketDto[]> | null = null;

  constructor(private readonly prisma: PrismaService) {
    this.restoreIntegrationConfig();
  }

  getIntegrationConfig(): MarketsIntegrationConfig {
    return { ...this.integrationConfig };
  }

  updateIntegrationConfig(input: Partial<MarketsIntegrationConfig>): MarketsIntegrationConfig {
    const next: MarketsIntegrationConfig = { ...this.integrationConfig };

    if (input.exchangeUrl !== undefined) {
      try {
        const url = new URL(input.exchangeUrl.trim());
        if (!url.protocol.startsWith("http")) {
          throw new Error("invalid_protocol");
        }
        next.exchangeUrl = url.toString();
      } catch {
        throw new BadRequestException("invalid_markets_exchange_url");
      }
    }

    if (input.tagSlug !== undefined) {
      const value = input.tagSlug.trim().toLowerCase();
      if (!value) {
        throw new BadRequestException("invalid_markets_tag_slug");
      }
      next.tagSlug = value;
    }

    if (input.limit !== undefined) {
      if (!Number.isFinite(input.limit)) {
        throw new BadRequestException("invalid_markets_limit");
      }
      next.limit = Math.max(6, Math.min(200, Math.round(input.limit)));
    }

    if (input.timeoutMs !== undefined) {
      if (!Number.isFinite(input.timeoutMs)) {
        throw new BadRequestException("invalid_markets_timeout");
      }
      next.timeoutMs = Math.max(1500, Math.min(30000, Math.round(input.timeoutMs)));
    }

    this.integrationConfig = next;
    this.memoryCache = null;
    this.persistIntegrationConfig();
    return this.getIntegrationConfig();
  }

  async getMarkets(): Promise<MarketDto[]> {
    const now = Date.now();
    if (this.memoryCache && this.memoryCache.expiresAt > now) {
      return this.memoryCache.data;
    }

    if (this.memoryCache?.data?.length) {
      // Serve stale data immediately and refresh in background to keep first paint responsive.
      this.refreshMarketsInBackground();
      return this.memoryCache.data;
    }

    return this.refreshMarketsNow(now);
  }

  private async refreshMarketsNow(now: number): Promise<MarketDto[]> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.refreshMarketsInternal(now).finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private refreshMarketsInBackground(): void {
    if (this.refreshPromise) {
      return;
    }
    this.refreshPromise = this.refreshMarketsInternal(Date.now())
      .catch(() => this.memoryCache?.data ?? [])
      .finally(() => {
        this.refreshPromise = null;
      });
  }

  private async refreshMarketsInternal(now: number): Promise<MarketDto[]> {
    const exchangeMarkets = await this.fetchExchangeMarkets();
    if (exchangeMarkets.length) {
      this.updateMemoryCache(exchangeMarkets, now);
      return exchangeMarkets;
    }

    if (this.enableDatabaseFallback) {
      const dbMarkets = await this.fetchDatabaseMarkets();
      if (dbMarkets.length) {
        this.updateMemoryCache(dbMarkets, now);
        return dbMarkets;
      }
    }

    if (this.allowSeedFallback) {
      const normalizedSeed = seed.map((item) => normalizeLegacyMarket(item));
      this.updateMemoryCache(normalizedSeed, now);
      return normalizedSeed;
    }

    throw new ServiceUnavailableException("exchange_markets_unavailable");
  }

  private async fetchExchangeMarkets(): Promise<MarketDto[]> {
    const url = new URL(this.integrationConfig.exchangeUrl);
    if (!url.searchParams.has("limit")) {
      url.searchParams.set("limit", String(this.integrationConfig.limit));
    }
    if (!url.searchParams.has("tag_slug")) {
      url.searchParams.set("tag_slug", this.integrationConfig.tagSlug);
    }
    if (!url.searchParams.has("active")) {
      url.searchParams.set("active", "true");
    }
    if (!url.searchParams.has("closed")) {
      url.searchParams.set("closed", "false");
    }
    if (!url.searchParams.has("archived")) {
      url.searchParams.set("archived", "false");
    }

    const payload = await this.requestExchangePayload(url);
    if (!payload) {
      return [];
    }

    try {
      const mappedById = new Map<string, MarketDto>();
      for (const event of payload) {
        const eventMarkets = Array.isArray(event.markets) ? event.markets : [];
        for (const rawMarket of eventMarkets) {
          const enriched: GammaMarket = {
            ...(rawMarket as GammaMarket),
            events: [
              {
                title: event.title,
                endDate: event.endDate,
                openInterest: event.openInterest,
              },
            ],
          };
          const mapped = mapGammaMarket(enriched);
          if (mapped) {
            mappedById.set(mapped.id, mapped);
          }
        }
      }

      const mapped = Array.from(mappedById.values())
        .sort((a, b) => {
          const liveRank = Number(b.live) - Number(a.live);
          if (liveRank !== 0) {
            return liveRank;
          }

          const oiRank = b.oi - a.oi;
          if (oiRank !== 0) {
            return oiRank;
          }

          return Math.abs(b.change24h) - Math.abs(a.change24h);
        })
        .slice(0, this.integrationConfig.limit);

      return mapped;
    } catch (error) {
      this.warnExchange(`Exchange markets mapping failed: ${this.formatError(error)}`);
      return [];
    }
  }

  private async requestExchangePayload(url: URL): Promise<GammaTaggedEvent[] | null> {
    let nativeError = "";
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(this.integrationConfig.timeoutMs),
      });

      if (!response.ok) {
        nativeError = `status_${response.status}`;
      } else {
        const payload = (await response.json()) as unknown;
        if (Array.isArray(payload)) {
          return payload as GammaTaggedEvent[];
        }
        nativeError = "invalid_payload";
      }
    } catch (error) {
      nativeError = this.formatError(error);
    }

    if (this.enablePowerShellFallback) {
      const fallbackPayload = await this.fetchViaPowerShell(url);
      if (fallbackPayload) {
        return fallbackPayload;
      }
    }

    const fallbackLabel = this.enablePowerShellFallback ? "powershell_attempted" : "powershell_disabled";
    this.warnExchange(`Exchange markets fetch failed: native=${nativeError}; ${fallbackLabel}`);
    return null;
  }

  private async fetchViaPowerShell(url: URL): Promise<GammaTaggedEvent[] | null> {
    const timeoutSec = Math.max(3, Math.ceil(this.integrationConfig.timeoutMs / 1000));
    const escapedUrl = url.toString().replace(/'/g, "''");
    const command =
      `$ProgressPreference='SilentlyContinue';` +
      `(Invoke-WebRequest -Uri '${escapedUrl}' -TimeoutSec ${timeoutSec}).Content`;

    try {
      const result = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
        { maxBuffer: 1024 * 1024 * 50 },
      );
      const payload = JSON.parse(result.stdout) as unknown;
      if (!Array.isArray(payload)) {
        this.warnExchange("Exchange markets PowerShell payload is not an array");
        return null;
      }
      return payload as GammaTaggedEvent[];
    } catch (error) {
      this.warnExchange(`Exchange markets PowerShell fetch failed: ${this.formatError(error)}`);
      return null;
    }
  }

  private async fetchDatabaseMarkets(): Promise<MarketDto[]> {
    try {
      const rows = await this.prisma.market.findMany({ orderBy: { createdAt: "asc" } });
      return rows.map((row: MarketRow) =>
        normalizeLegacyMarket({
          id: row.symbol,
          title: row.title,
          location: row.location,
          odds: row.odds,
          change24h: row.change24h,
          oi: row.oi,
          live: row.live,
          source: "DATABASE",
        }),
      );
    } catch {
      return [];
    }
  }

  private restoreIntegrationConfig(): void {
    try {
      if (!existsSync(this.configPath)) {
        return;
      }
      const payload = JSON.parse(readFileSync(this.configPath, "utf8")) as Partial<MarketsIntegrationConfig>;
      this.updateIntegrationConfig(payload);
    } catch (error) {
      this.warnExchange(`Failed to restore markets integration config: ${this.formatError(error)}`);
    }
  }

  private persistIntegrationConfig(): void {
    try {
      mkdirSync(dirname(this.configPath), { recursive: true });
      writeFileSync(this.configPath, JSON.stringify(this.integrationConfig, null, 2), "utf8");
    } catch (error) {
      this.warnExchange(`Failed to persist markets integration config: ${this.formatError(error)}`);
    }
  }

  private formatError(error: unknown): string {
    if (!(error instanceof Error)) {
      return String(error);
    }

    const causeCode = (error as Error & { cause?: { code?: string } }).cause?.code;
    return causeCode ? `${error.message} (${causeCode})` : error.message;
  }

  private updateMemoryCache(data: MarketDto[], nowMs: number): void {
    this.memoryCache = {
      data,
      expiresAt: nowMs + this.cacheTtlSec * 1000,
    };
  }

  private warnExchange(message: string): void {
    const now = Date.now();
    if (now - this.lastExchangeWarnAt < 30000) {
      return;
    }

    this.lastExchangeWarnAt = now;
    this.logger.warn(message);
  }
}
