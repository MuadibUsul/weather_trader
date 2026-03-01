import { Body, Controller, Get, Post, Put } from "@nestjs/common";
import { StrategyService } from "./strategy.service";
import { StartStrategyDto } from "./dto/start-strategy.dto";
import { UpdateStrategyDto } from "./dto/update-strategy.dto";

@Controller("strategy")
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get()
  getStrategy() {
    return this.strategyService.getConfig();
  }

  @Get("runtime")
  getRuntime() {
    return this.strategyService.getRuntime();
  }

  @Put()
  updateStrategy(@Body() dto: UpdateStrategyDto) {
    return this.strategyService.updateConfig(dto);
  }

  @Post("start")
  startStrategy(@Body() dto: StartStrategyDto = {}) {
    return this.strategyService.start(dto);
  }

  @Post("stop")
  stopStrategy() {
    return this.strategyService.stop();
  }
}
