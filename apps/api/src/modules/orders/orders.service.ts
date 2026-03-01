import { Injectable } from "@nestjs/common";
import type { Environment, OrderLifecycleEventDto, OrderPreviewDto, OrderQuoteDto } from "@weather-trader/shared";
import { ExecutionApplicationService, type OrderView, type WalletSnapshotView } from "../execution/execution-application.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { PreviewOrderDto } from "./dto/preview-order.dto";

@Injectable()
export class OrdersService {
  constructor(private readonly execution: ExecutionApplicationService) {}

  list(query: ListOrdersQueryDto = {}): OrderView[] {
    return this.execution.list(query);
  }

  getWalletSnapshot(environment?: Environment): Promise<WalletSnapshotView> {
    return this.execution.getWalletSnapshot(environment);
  }

  getExecutionHealth() {
    return this.execution.getExecutionHealth();
  }

  listOpen(environment?: Environment, limit?: number): OrderView[] {
    return this.execution.listOpen(environment, limit);
  }

  listEvents(orderId: string, limit?: number): OrderLifecycleEventDto[] {
    return this.execution.listEvents(orderId, limit);
  }

  cancel(orderId: string, reason?: string): Promise<OrderView> {
    return this.execution.cancel(orderId, reason);
  }

  quote(params: { marketId: string; environment?: Environment }): Promise<OrderQuoteDto> {
    return this.execution.quote(params);
  }

  preview(input: PreviewOrderDto): Promise<OrderPreviewDto> {
    return this.execution.preview(input);
  }

  create(input: CreateOrderDto): Promise<OrderView> {
    return this.execution.create(input);
  }
}

export type { OrderView };
