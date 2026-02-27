import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { RedisService } from "../../redis.service";

export type MarketDto = {
  id: string;
  title: string;
  location: string;
  odds: number;
  change24h: number;
  oi: number;
  live: boolean;
};

const seed: MarketDto[] = [
  { id: "NYC_GT_85", title: "NYC > 85°F", location: "New York", odds: 0.65, change24h: 12.5, oi: 452190, live: true },
  { id: "NYC_75_85", title: "NYC 75-85°F", location: "New York", odds: 0.32, change24h: -5.2, oi: 128400, live: false },
  { id: "NYC_LT_75", title: "NYC < 75°F", location: "New York", odds: 0.03, change24h: 0, oi: 12050, live: false },
  { id: "CHI_GT_80", title: "CHI > 80°F", location: "Chicago", odds: 0.48, change24h: 2.1, oi: 88200, live: false },
  { id: "LA_GT_90", title: "LA > 90°F", location: "Los Angeles", odds: 0.12, change24h: -8.4, oi: 32100, live: false },
  { id: "LND_LT_15", title: "LND < 15°C", location: "London", odds: 0.55, change24h: 1.2, oi: 65300, live: false },
];

@Injectable()
export class MarketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getMarkets(): Promise<MarketDto[]> {
    const cache = await this.redis.get<MarketDto[]>("markets:list");
    if (cache?.length) {
      return cache;
    }

    try {
      const rows = await this.prisma.market.findMany({ orderBy: { createdAt: "asc" } });
      if (rows.length) {
        const mapped = rows.map((r: {
          symbol: string;
          title: string;
          location: string;
          odds: number;
          change24h: number;
          oi: number;
          live: boolean;
        }) => ({
          id: r.symbol,
          title: r.title,
          location: r.location,
          odds: r.odds,
          change24h: r.change24h,
          oi: r.oi,
          live: r.live,
        }));
        await this.redis.set("markets:list", mapped, 10);
        return mapped;
      }
    } catch {
      // fallback to seed
    }

    await this.redis.set("markets:list", seed, 10);
    return seed;
  }
}
