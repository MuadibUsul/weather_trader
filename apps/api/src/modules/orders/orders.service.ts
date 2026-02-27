import { Injectable } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto";
import { EventsGateway } from "../../gateway/events.gateway";

export type OrderView = {
  id: string;
  marketId: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  amount: number;
  fee: number;
  pnl: number;
  environment: "REAL" | "PAPER";
  status: "filled" | "open" | "cancelled";
  createdAt: string;
};

@Injectable()
export class OrdersService {
  private seq = 8829;
  private readonly orders: OrderView[] = [
    {
      id: "#8829",
      marketId: "NYC_GT_85",
      side: "buy",
      quantity: 500,
      price: 0.64,
      amount: 320,
      fee: 0.32,
      pnl: 45,
      environment: "REAL",
      status: "filled",
      createdAt: new Date().toISOString(),
    },
  ];

  constructor(private readonly events: EventsGateway) {}

  list() {
    return this.orders;
  }

  create(input: CreateOrderDto): OrderView {
    const feeRate = input.environment === "REAL" ? 0.001 : 0;
    const amount = input.quantity * input.price;
    const fee = Number((amount * feeRate).toFixed(4));

    const order: OrderView = {
      id: `#${this.seq++}`,
      marketId: input.marketId,
      side: input.side,
      quantity: input.quantity,
      price: input.price,
      amount,
      fee,
      pnl: 0,
      environment: (input.environment ?? "REAL") as "REAL" | "PAPER",
      status: "filled",
      createdAt: new Date().toISOString(),
    };

    this.orders.unshift(order);
    this.events.emitOrderUpdate(order);
    this.events.emitSystemLog({ level: "info", message: `Order ${order.id} created` });

    return order;
  }
}
