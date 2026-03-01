import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

type WeatherMarket = {
  id: string;
  title: string;
  city: string;
  marketType: "BINARY" | "MULTI_OUTCOME";
  closeTimeMs: number;
  resolveTimeMs: number;
  status: "OPEN" | "CLOSED" | "RESOLVED" | "CANCELED";
  outcomes: Array<{ id: string; label: string }>;
};

type MarketQuote = {
  marketId: string;
  ts: number;
  outcomes: Record<
    string,
    {
      outcomeId: string;
      bestBid: number;
      bestAsk: number;
      bidSize: number;
      askSize: number;
      midpoint: number;
    }
  >;
};

type ForecastPoint = {
  marketId: string;
  outcomeId: string;
  forecastTs: number;
  resolveTs: number;
  probability: number;
  source: string;
};

type MarketSettlement = {
  marketId: string;
  ts: number;
  reason: "RESOLVED" | "CANCELED";
  winningOutcomeId: string | null;
  source?: string;
};

type GammaEventMarket = {
  id?: unknown;
  conditionId?: unknown;
  question?: unknown;
  endDate?: unknown;
  closeTime?: unknown;
  outcomes?: unknown;
  outcomePrices?: unknown;
  clobTokenIds?: unknown;
};

type GammaEvent = {
  id?: unknown;
  title?: unknown;
  slug?: unknown;
  endDate?: unknown;
  closedTime?: unknown;
  markets?: unknown;
};

type ClobHistoryPoint = {
  t: number;
  p: number;
};

type ClobHistoryResponse = {
  history?: ClobHistoryPoint[];
};

const execFileAsync = promisify(execFile);

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function asNumber(value: unknown): number | null {
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

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item));
      }
    } catch {
      return [];
    }
  }
  return [];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function guessCity(text: string): string {
  const upper = text.toUpperCase();
  const known = ["NYC", "NEW YORK", "CHICAGO", "LONDON", "SEOUL", "TOKYO", "MIAMI", "LOS ANGELES", "LA", "PARIS"];
  const match = known.find((item) => upper.includes(item));
  if (match) {
    return match;
  }
  return "UNKNOWN";
}

@Injectable()
export class PolymarketOfficialDataService {
  private readonly logger = new Logger(PolymarketOfficialDataService.name);

  async loadResolvedWeatherScenario(input: {
    marketLimit: number;
    fidelitySec: number;
    syntheticSpread: number;
    syntheticDepth: number;
  }): Promise<{
    markets: WeatherMarket[];
    quotes: MarketQuote[];
    forecasts: ForecastPoint[];
    settlements: MarketSettlement[];
    sourceMeta: Record<string, unknown>;
  }> {
    const events = await this.fetchResolvedWeatherEvents(Math.max(1, input.marketLimit * 2));
    const selectedMarkets = this.extractBinaryMarkets(events).slice(0, input.marketLimit);
    if (selectedMarkets.length === 0) {
      throw new Error("no_resolved_weather_markets_available");
    }

    const markets: WeatherMarket[] = [];
    const quotes: MarketQuote[] = [];
    const forecasts: ForecastPoint[] = [];
    const settlements: MarketSettlement[] = [];

    for (const market of selectedMarkets) {
      const history = await this.fetchHistory(market.yesTokenId, input.fidelitySec);
      if (history.length < 3) {
        continue;
      }

      markets.push({
        id: market.marketId,
        title: market.title,
        city: market.city,
        marketType: "BINARY",
        closeTimeMs: market.closeTimeMs,
        resolveTimeMs: market.resolveTimeMs,
        status: "RESOLVED",
        outcomes: [
          { id: "YES", label: market.outcomes[0] ?? "Yes" },
          { id: "NO", label: market.outcomes[1] ?? "No" },
        ],
      });

      for (let idx = 0; idx < history.length; idx += 1) {
        const row = history[idx];
        const tsMs = row.t * 1000;
        const yesMid = clamp01(row.p);
        const noMid = clamp01(1 - yesMid);
        const spread = Math.max(0.002, Math.min(0.2, input.syntheticSpread));
        const yesBid = clamp01(yesMid - spread / 2);
        const yesAsk = clamp01(yesMid + spread / 2);
        const noBid = clamp01(noMid - spread / 2);
        const noAsk = clamp01(noMid + spread / 2);

        quotes.push({
          marketId: market.marketId,
          ts: tsMs,
          outcomes: {
            YES: {
              outcomeId: "YES",
              bestBid: yesBid,
              bestAsk: yesAsk,
              bidSize: input.syntheticDepth,
              askSize: input.syntheticDepth,
              midpoint: yesMid,
            },
            NO: {
              outcomeId: "NO",
              bestBid: noBid,
              bestAsk: noAsk,
              bidSize: input.syntheticDepth,
              askSize: input.syntheticDepth,
              midpoint: noMid,
            },
          },
        });

        if (idx >= 2) {
          const prev = history[idx - 1]?.p ?? yesMid;
          const prev2 = history[idx - 2]?.p ?? prev;
          const momentum = prev - prev2;
          const modelProb = clamp01(prev + momentum * 0.4);
          forecasts.push({
            marketId: market.marketId,
            outcomeId: "YES",
            forecastTs: tsMs,
            resolveTs: market.resolveTimeMs,
            probability: modelProb,
            source: "official_clob_momentum_v1",
          });
        }
      }

      settlements.push({
        marketId: market.marketId,
        ts: market.resolveTimeMs,
        reason: "RESOLVED",
        winningOutcomeId: market.winningOutcome,
        source: "polymarket_gamma_outcome_prices",
      });
    }

    if (markets.length === 0 || quotes.length === 0 || settlements.length === 0) {
      throw new Error("insufficient_official_market_data");
    }

    return {
      markets,
      quotes: quotes.sort((a, b) => a.ts - b.ts),
      forecasts: forecasts.sort((a, b) => a.forecastTs - b.forecastTs),
      settlements: settlements.sort((a, b) => a.ts - b.ts),
      sourceMeta: {
        eventsFetched: events.length,
        marketsUsed: markets.length,
        quotePoints: quotes.length,
        forecastPoints: forecasts.length,
        settlements: settlements.length,
      },
    };
  }

  private async fetchResolvedWeatherEvents(limit: number): Promise<GammaEvent[]> {
    const url = `https://gamma-api.polymarket.com/events?tag_slug=weather&closed=true&limit=${limit}`;
    const payload = await this.requestJson(url);
    if (!Array.isArray(payload)) {
      throw new Error("gamma_events_invalid_payload");
    }
    return payload as GammaEvent[];
  }

  private extractBinaryMarkets(events: GammaEvent[]): Array<{
    marketId: string;
    title: string;
    city: string;
    closeTimeMs: number;
    resolveTimeMs: number;
    outcomes: string[];
    yesTokenId: string;
    winningOutcome: "YES" | "NO" | null;
  }> {
    const rows: Array<{
      marketId: string;
      title: string;
      city: string;
      closeTimeMs: number;
      resolveTimeMs: number;
      outcomes: string[];
      yesTokenId: string;
      winningOutcome: "YES" | "NO" | null;
    }> = [];

    for (const event of events) {
      const markets = Array.isArray(event.markets) ? (event.markets as GammaEventMarket[]) : [];
      for (const market of markets) {
        const marketId = asString(market.conditionId) ?? asString(market.id);
        if (!marketId) {
          continue;
        }
        const outcomes = parseJsonArray(market.outcomes);
        const outcomePrices = parseJsonArray(market.outcomePrices).map((item) => Number(item));
        const tokenIds = parseJsonArray(market.clobTokenIds);
        if (outcomes.length !== 2 || tokenIds.length < 1) {
          continue;
        }

        const title = asString(market.question) ?? asString(event.title) ?? marketId;
        const endDateRaw = asString(market.endDate) ?? asString(event.endDate);
        const endMs = endDateRaw ? Date.parse(endDateRaw) : Date.now();
        const closeMs = endMs;
        const resolveMs = endMs + 1000;
        const winningOutcome =
          outcomePrices[0] >= 0.999 ? ("YES" as const) : outcomePrices[1] >= 0.999 ? ("NO" as const) : null;
        rows.push({
          marketId,
          title,
          city: guessCity(title),
          closeTimeMs: closeMs,
          resolveTimeMs: resolveMs,
          outcomes,
          yesTokenId: tokenIds[0],
          winningOutcome,
        });
      }
    }

    return rows;
  }

  private async fetchHistory(tokenId: string, fidelitySec: number): Promise<ClobHistoryPoint[]> {
    const url = `https://clob.polymarket.com/prices-history?market=${tokenId}&interval=max&fidelity=${fidelitySec}`;
    try {
      const payload = (await this.requestJson(url)) as ClobHistoryResponse;
      const rows = Array.isArray(payload.history) ? payload.history : [];
      return rows
        .map((item) => ({ t: asNumber(item.t) ?? 0, p: asNumber(item.p) ?? 0 }))
        .filter((item) => item.t > 0 && item.p >= 0 && item.p <= 1)
        .sort((a, b) => a.t - b.t);
    } catch (error) {
      this.logger.warn(`prices-history fetch failed for ${tokenId}: ${(error as Error).message}`);
      return [];
    }
  }

  private async requestJson(url: string): Promise<unknown> {
    try {
      const response = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        throw new Error(`http_${response.status}`);
      }
      return (await response.json()) as unknown;
    } catch (error) {
      if (process.platform !== "win32") {
        throw error;
      }

      const escaped = url.replace(/'/g, "''");
      const command =
        `$ProgressPreference='SilentlyContinue';` +
        `(Invoke-WebRequest -Uri '${escaped}' -TimeoutSec 25).Content`;
      const result = await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
        { maxBuffer: 1024 * 1024 * 20 },
      );
      return JSON.parse(result.stdout) as unknown;
    }
  }
}
