import { Controller, Get, Query } from "@nestjs/common";
import { ControlMarketScanService } from "./control.market-scan.service";

type EnvQuery = "REAL" | "PAPER";

@Controller("api/market_scan")
export class ControlMarketScanController {
  constructor(private readonly marketScanService: ControlMarketScanService) {}

  @Get()
  scan(
    @Query("env") env: EnvQuery = "PAPER",
    @Query("city") city?: string,
    @Query("filters") filters?: string,
    @Query("sort") sort: "deviation" | "liquidity" | "slippage" = "deviation",
  ) {
    return this.marketScanService.scan({
      env,
      city,
      keyword: filters,
      sort,
    });
  }
}
