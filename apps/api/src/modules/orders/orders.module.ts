import { Module } from "@nestjs/common";
import { ExecutionModule } from "../execution/execution.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [ExecutionModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService, ExecutionModule],
})
export class OrdersModule {}
