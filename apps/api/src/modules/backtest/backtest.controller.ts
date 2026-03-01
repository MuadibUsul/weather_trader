import { Body, Controller, Post } from "@nestjs/common";
import { BacktestService } from "./backtest.service";
import { BacktestRequestDto } from "./dto/backtest-request.dto";
import { WeatherPaperRequestDto } from "./dto/weather-paper-request.dto";

@Controller("backtest")
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post()
  runBacktest(@Body() dto: BacktestRequestDto) {
    return this.backtestService.run(dto);
  }

  @Post("weather-paper")
  runWeatherPaper(@Body() dto: WeatherPaperRequestDto) {
    return this.backtestService.runWeatherPaper(dto);
  }
}
