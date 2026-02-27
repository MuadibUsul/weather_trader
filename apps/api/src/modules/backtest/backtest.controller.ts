import { Body, Controller, Post } from "@nestjs/common";
import { BacktestService } from "./backtest.service";
import { BacktestRequestDto } from "./dto/backtest-request.dto";

@Controller("backtest")
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post()
  runBacktest(@Body() dto: BacktestRequestDto) {
    return this.backtestService.run(dto);
  }
}
