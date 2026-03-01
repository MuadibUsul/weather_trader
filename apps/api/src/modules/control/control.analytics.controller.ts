import { Controller, Get, Query } from "@nestjs/common";
import { ControlAnalyticsService } from "./control.analytics.service";

type EnvQuery = "REAL" | "PAPER";
type RangeQuery = "1D" | "7D" | "30D" | "ALL";
type GroupBy = "strategy" | "city" | "date";

@Controller("api/analytics")
export class ControlAnalyticsController {
  constructor(private readonly analytics: ControlAnalyticsService) {}

  @Get("pnl_attribution")
  pnlAttribution(
    @Query("env") env: EnvQuery = "PAPER",
    @Query("range") range: RangeQuery = "7D",
    @Query("group_by") groupBy: GroupBy = "strategy",
  ) {
    return this.analytics.getPnlAttribution(env, range, groupBy);
  }

  @Get("reconcile")
  reconcile(@Query("env") env: EnvQuery = "PAPER", @Query("range") range: RangeQuery = "7D") {
    return this.analytics.reconcileFillsVsPnl(env, range);
  }
}
