import { Module } from "@nestjs/common";
import { MarketsModule } from "../markets/markets.module";
import { ControlAnalyticsController } from "./control.analytics.controller";
import { ControlAnalyticsService } from "./control.analytics.service";
import { ControlAllocatorService } from "./control.allocator.service";
import { ControlDashboardController } from "./control.dashboard.controller";
import { ControlDashboardService } from "./control.dashboard.service";
import { ControlMarketScanController } from "./control.market-scan.controller";
import { ControlMarketScanService } from "./control.market-scan.service";
import { ControlRiskService } from "./control.risk.service";
import { ControlStoreService } from "./control.store";
import { ControlStrategyGovernanceController } from "./control.strategy-governance.controller";
import { ControlStrategyGovernanceService } from "./control.strategy-governance.service";

@Module({
  imports: [MarketsModule],
  controllers: [
    ControlDashboardController,
    ControlStrategyGovernanceController,
    ControlMarketScanController,
    ControlAnalyticsController,
  ],
  providers: [
    ControlStoreService,
    ControlDashboardService,
    ControlStrategyGovernanceService,
    ControlAllocatorService,
    ControlRiskService,
    ControlMarketScanService,
    ControlAnalyticsService,
  ],
  exports: [ControlStoreService, ControlDashboardService, ControlStrategyGovernanceService, ControlAllocatorService, ControlRiskService],
})
export class ControlModule {}
