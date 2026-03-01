import { Module } from "@nestjs/common";
import { BacktestController } from "./backtest.controller";
import { BacktestService } from "./backtest.service";
import { PolymarketOfficialDataService } from "./polymarket-official-data.service";

@Module({
  controllers: [BacktestController],
  providers: [BacktestService, PolymarketOfficialDataService],
  exports: [BacktestService],
})
export class BacktestModule {}
