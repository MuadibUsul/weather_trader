import { Module } from "@nestjs/common";
import { MarketsModule } from "./modules/markets/markets.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { StrategyModule } from "./modules/strategy/strategy.module";
import { BacktestModule } from "./modules/backtest/backtest.module";
import { SystemModule } from "./modules/system/system.module";
import { CoreModule } from "./core.module";
import { ControlModule } from "./modules/control/control.module";

@Module({
  imports: [CoreModule, SystemModule, MarketsModule, OrdersModule, StrategyModule, BacktestModule, ControlModule],
})
export class AppModule {}

