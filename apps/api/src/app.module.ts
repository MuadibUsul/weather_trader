import { Module } from "@nestjs/common";
import { MarketsModule } from "./modules/markets/markets.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { StrategyModule } from "./modules/strategy/strategy.module";
import { BacktestModule } from "./modules/backtest/backtest.module";
import { CoreModule } from "./core.module";

@Module({
  imports: [CoreModule, MarketsModule, OrdersModule, StrategyModule, BacktestModule],
})
export class AppModule {}

