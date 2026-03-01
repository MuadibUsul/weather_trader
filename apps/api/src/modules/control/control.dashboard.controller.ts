import { Controller, Get, Query } from "@nestjs/common";
import { ControlDashboardService } from "./control.dashboard.service";

type EnvQuery = "REAL" | "PAPER";
type RangeQuery = "1D" | "7D" | "30D" | "ALL";

@Controller("api/dashboard")
export class ControlDashboardController {
  constructor(private readonly dashboard: ControlDashboardService) {}

  @Get("summary")
  summary(@Query("env") env: EnvQuery = "PAPER", @Query("range") range: RangeQuery = "7D") {
    return this.dashboard.getSummary(env, range);
  }

  @Get("equity_curve")
  equityCurve(@Query("range") range: RangeQuery = "30D", @Query("compare") compare: "paper" | "real" = "real") {
    return this.dashboard.getEquityCurve(compare, range);
  }

  @Get("strategy_leaderboard")
  strategyLeaderboard(@Query("env") env: EnvQuery = "PAPER", @Query("range") range: RangeQuery = "7D") {
    return this.dashboard.getStrategyLeaderboard(env, range);
  }

  @Get("exposures")
  exposures(@Query("env") env: EnvQuery = "PAPER", @Query("range") range: RangeQuery = "7D") {
    return this.dashboard.getExposures(env, range);
  }

  @Get("health")
  health(
    @Query("env") env: EnvQuery = "PAPER",
    @Query("range") range: RangeQuery = "7D",
    @Query("strategy_id") strategyId?: string,
  ) {
    return this.dashboard.getHealth(env, range, strategyId);
  }

  @Get("top_signals")
  topSignals(@Query("env") env: EnvQuery = "PAPER", @Query("limit") limit = "10") {
    const parsed = Number(limit);
    return this.dashboard.getTopSignals(env, Number.isFinite(parsed) ? parsed : 10);
  }
}
