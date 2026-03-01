import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { OrderQuoteQueryDto } from "./dto/order-quote-query.dto";
import { PreviewOrderDto } from "./dto/preview-order.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getOrders(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.list(query);
  }

  @Get("wallet-snapshot")
  getWalletSnapshot(@Query("environment") environment?: "REAL" | "PAPER") {
    return this.ordersService.getWalletSnapshot(environment);
  }

  @Get("execution-health")
  getExecutionHealth() {
    return this.ordersService.getExecutionHealth();
  }

  @Get("open")
  getOpenOrders(@Query("environment") environment?: "REAL" | "PAPER", @Query("limit") limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.ordersService.listOpen(environment, Number.isFinite(parsedLimit) ? parsedLimit : undefined);
  }

  @Get(":orderId/events")
  getOrderEvents(@Param("orderId") orderId: string, @Query("limit") limit?: string) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.ordersService.listEvents(orderId, Number.isFinite(parsedLimit) ? parsedLimit : undefined);
  }

  @Get("quote")
  getQuote(@Query() query: OrderQuoteQueryDto) {
    return this.ordersService.quote(query);
  }

  @Post("preview")
  previewOrder(@Body() dto: PreviewOrderDto) {
    return this.ordersService.preview(dto);
  }

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Post(":orderId/cancel")
  async cancelOrder(@Param("orderId") orderId: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancel(orderId, dto.reason);
  }
}
