import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ["websocket", "polling"],
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  afterInit() {
    this.logger.log("WS gateway initialized");
  }

  handleConnection(client: Socket) {
    this.logger.log(`WS connected: ${client.id}`);
  }

  emitPriceUpdate(payload: unknown) {
    this.server.emit("price_update", payload);
  }

  emitOrderUpdate(payload: unknown) {
    this.server.emit("order_update", payload);
  }

  emitRiskAlert(payload: unknown) {
    this.server.emit("risk_alert", payload);
  }

  emitSystemLog(payload: unknown) {
    this.server.emit("system_log", payload);
  }
}
