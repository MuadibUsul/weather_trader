const fs = require("fs");
const path = require("path");

async function main() {
  const { BacktestService } = require("../apps/api/dist/apps/api/src/modules/backtest/backtest.service.js");
  const {
    PolymarketOfficialDataService,
  } = require("../apps/api/dist/apps/api/src/modules/backtest/polymarket-official-data.service.js");

  const events = {
    emitSystemLog: () => {},
    emitRiskAlert: () => {},
    emitOrderUpdate: () => {},
  };

  const service = new BacktestService(events, new PolymarketOfficialDataService());
  const result = await service.runWeatherPaper({
    initialCash: 10000,
    feeRate: 0.001,
    slippageBps: 10,
    matchingModel: "depth",
    edgeThreshold: 0.005,
    minConfidence: 0.05,
    orderNotional: 150,
    marketLimit: 6,
    fidelitySec: 3600,
    syntheticSpread: 0.02,
    syntheticDepth: 2500,
  });

  const outDir = path.resolve(process.cwd(), "runtime");
  fs.mkdirSync(outDir, { recursive: true });
  const outputPath = path.resolve(outDir, "weather-paper-official-report.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");

  const s = result.report.summary;
  const t = result.report.tradingMetrics;
  const f = result.report.forecastMetrics;
  // eslint-disable-next-line no-console
  console.log(
    [
      `report=${outputPath}`,
      `orders=${s.totalOrders}`,
      `fills=${s.totalFills}`,
      `settlements=${s.totalSettlements}`,
      `returnPct=${t.totalReturn}`,
      `mddPct=${t.maxDrawdownPct}`,
      `brier=${f.brierScore}`,
      `eligibleForReal=${result.realEligibility.eligibleForReal}`,
    ].join(" | "),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
