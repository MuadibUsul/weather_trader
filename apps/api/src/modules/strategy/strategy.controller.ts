import { Body, Controller, Get, Put } from "@nestjs/common";
import { StrategyService } from "./strategy.service";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";

@Controller("strategy")
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get()
  getStrategy() {
    return this.strategyService.getConfig();
  }

  @Put()
  updateStrategy(@Body() dto: UpdateStrategyDto) {
    return this.strategyService.updateConfig(dto);
  }
}
