import type { ForecastPoint, MarketQuote, MarketSettlement, WeatherMarket } from "./types";

const DAY_MS = 24 * 3600 * 1000;

export function createMockWeatherScenario(baseTs = Date.parse("2026-07-01T00:00:00.000Z")): {
  markets: WeatherMarket[];
  quotes: MarketQuote[];
  forecasts: ForecastPoint[];
  settlements: MarketSettlement[];
} {
  const marketId = "NYC_2026-07-04_HIGH_TEMP";
  const yesOutcome = "YES_GE_31C";
  const noOutcome = "NO_LT_31C";

  const markets: WeatherMarket[] = [
    {
      id: marketId,
      title: "NYC July 4 High Temp >= 31C?",
      city: "NYC",
      marketType: "BINARY",
      closeTimeMs: baseTs + DAY_MS * 2,
      resolveTimeMs: baseTs + DAY_MS * 3,
      status: "OPEN",
      outcomes: [
        { id: yesOutcome, label: "YES >=31C", thresholdC: 31 },
        { id: noOutcome, label: "NO <31C", thresholdC: 31 },
      ],
    },
  ];

  const quotes: MarketQuote[] = [
    {
      marketId,
      ts: baseTs,
      outcomes: {
        [yesOutcome]: { outcomeId: yesOutcome, bestBid: 0.43, bestAsk: 0.45, bidSize: 1200, askSize: 1100, midpoint: 0.44 },
        [noOutcome]: { outcomeId: noOutcome, bestBid: 0.55, bestAsk: 0.57, bidSize: 1000, askSize: 1200, midpoint: 0.56 },
      },
    },
    {
      marketId,
      ts: baseTs + DAY_MS,
      outcomes: {
        [yesOutcome]: { outcomeId: yesOutcome, bestBid: 0.49, bestAsk: 0.51, bidSize: 900, askSize: 1300, midpoint: 0.5 },
        [noOutcome]: { outcomeId: noOutcome, bestBid: 0.49, bestAsk: 0.51, bidSize: 1300, askSize: 900, midpoint: 0.5 },
      },
    },
    {
      marketId,
      ts: baseTs + DAY_MS * 2 - 3600 * 1000,
      outcomes: {
        [yesOutcome]: { outcomeId: yesOutcome, bestBid: 0.63, bestAsk: 0.65, bidSize: 1800, askSize: 1400, midpoint: 0.64 },
        [noOutcome]: { outcomeId: noOutcome, bestBid: 0.35, bestAsk: 0.37, bidSize: 1400, askSize: 1800, midpoint: 0.36 },
      },
    },
  ];

  const forecasts: ForecastPoint[] = [
    { marketId, outcomeId: yesOutcome, forecastTs: baseTs - DAY_MS * 3, resolveTs: baseTs + DAY_MS * 3, probability: 0.47, source: "gfs" },
    { marketId, outcomeId: yesOutcome, forecastTs: baseTs - DAY_MS, resolveTs: baseTs + DAY_MS * 3, probability: 0.55, source: "ecmwf" },
    { marketId, outcomeId: yesOutcome, forecastTs: baseTs + DAY_MS, resolveTs: baseTs + DAY_MS * 3, probability: 0.68, source: "blended" },
  ];

  const settlements: MarketSettlement[] = [
    {
      marketId,
      ts: baseTs + DAY_MS * 3,
      reason: "RESOLVED",
      winningOutcomeId: yesOutcome,
      observedTemperatureC: 32.4,
      source: "official-weather-station",
    },
  ];

  return { markets, quotes, forecasts, settlements };
}
