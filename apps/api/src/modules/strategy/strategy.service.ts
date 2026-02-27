import { Injectable } from "@nestjs/common";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";
import { EventsGateway } from "../../gateway/events.gateway";

@Injectable()
export class StrategyService {
  private config: UpdateStrategyDto = {
    model: "mean_reversion",
    autoTradeEnabled: false,
    triggerThreshold: 0.65,
    updateFrequencySec: 5,
    maxDailyLoss: 1000,
    maxPositionSize: 5000,
    maxOpenPositions: 3,
    slippageBps: 50,
  };

  constructor(private readonly events: EventsGateway) {}

  getConfig() {
    return this.config;
  }

  updateConfig(next: UpdateStrategyDto) {
    this.config = next;
    this.events.emitSystemLog({ level: "info", message: "Strategy config updated", payload: next });
    return this.config;
  }
}
