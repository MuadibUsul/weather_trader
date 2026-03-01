import { Controller, Get, Query } from "@nestjs/common";
import type { Environment } from "@weather-trader/shared";
import { SystemService } from "./system.service";

@Controller("api/env")
export class EnvController {
  constructor(private readonly systemService: SystemService) {}

  @Get("status")
  status(@Query("target") target: Environment = "REAL") {
    return this.systemService.getEnvStatus(target);
  }
}
