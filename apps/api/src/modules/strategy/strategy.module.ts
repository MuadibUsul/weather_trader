import { Module } from "@nestjs/common";
import { ControlModule } from "../control/control.module";
import { ExecutionModule } from "../execution/execution.module";
import { MarketsModule } from "../markets/markets.module";
import { SystemModule } from "../system/system.module";
import { StrategyController } from "./strategy.controller";
import { StrategyService } from "./strategy.service";

@Module({
  imports: [SystemModule, MarketsModule, ExecutionModule, ControlModule],
  controllers: [StrategyController],
  providers: [StrategyService],
  exports: [StrategyService],
})
export class StrategyModule {}
