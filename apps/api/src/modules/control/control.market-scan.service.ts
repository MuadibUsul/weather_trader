import { Injectable } from "@nestjs/common";
import type { Environment, MarketScanItemDto } from "@weather-trader/shared";
import { MarketsService } from "../markets/markets.service";
import { ControlStoreService } from "./control.store";

@Injectable()
export class ControlMarketScanService {
  constructor(
    private readonly markets: MarketsService,
    private readonly store: ControlStoreService,
  ) {}

  async scan(params: {
    env: Environment;
    city?: string;
    keyword?: string;
    sort?: "deviation" | "liquidity" | "slippage";
  }): Promise<MarketScanItemDto[]> {
    const markets = await this.markets.getMarkets();
    const latestSignals = this.store.listSignals({ env: params.env, limit: 1500 });
    const byMarketSignal = new Map<string, number>();

    for (const signal of latestSignals) {
      const prev = byMarketSignal.get(signal.marketId);
      const nextProb = signal.modelProb;
      byMarketSignal.set(signal.marketId, prev === undefined ? nextProb : Number(((prev + nextProb) / 2).toFixed(6)));
    }

    const rows = markets
      .map<MarketScanItemDto>((item) => {
        const marketImpliedProb = item.odds;
        const modelProb = byMarketSignal.get(item.id) ?? Number((Math.min(0.98, Math.max(0.02, item.odds + item.change24h / 100))).toFixed(4));
        const deviation = Number((modelProb - marketImpliedProb).toFixed(6));
        const bestBid = Number((item.bestBid ?? Math.max(0, item.odds - 0.01)).toFixed(4));
        const bestAsk = Number((item.bestAsk ?? Math.min(1, item.odds + 0.01)).toFixed(4));
        const spreadBps = Number((((bestAsk - bestBid) / Math.max(bestAsk, 0.0001)) * 10000).toFixed(4));
        const estimatedSlippageBps = Number(Math.max(5, spreadBps * 0.45).toFixed(4));
        const impactCost = Number(((estimatedSlippageBps / 10000) * 1000).toFixed(4));
        const liquidityScore = Number(Math.max(0, 100 - spreadBps * 0.08).toFixed(2));

        return {
          marketId: item.id,
          title: item.title,
          location: item.location,
          endDate: item.endDate,
          modelProb,
          marketImpliedProb,
          deviation,
          bestBid,
          bestAsk,
          spreadBps,
          estimatedSlippageBps,
          impactCost,
          liquidityScore,
        };
      })
      .filter((item) => (!params.city ? true : item.location.includes(params.city)))
      .filter((item) => (!params.keyword ? true : item.title.toLowerCase().includes(params.keyword.toLowerCase())));

    const sort = params.sort ?? "deviation";
    rows.sort((a, b) => {
      if (sort === "liquidity") {
        return b.liquidityScore - a.liquidityScore;
      }
      if (sort === "slippage") {
        return a.estimatedSlippageBps - b.estimatedSlippageBps;
      }
      return Math.abs(b.deviation) - Math.abs(a.deviation);
    });

    return rows;
  }
}
