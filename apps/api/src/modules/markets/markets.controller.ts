import { Body, Controller, Get, Put } from "@nestjs/common";
import { MarketsService } from "./markets.service";
import { UpdateMarketsIntegrationDto } from "./dto/update-markets-integration.dto";

@Controller("markets")
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get()
  async getMarkets() {
    return this.marketsService.getMarkets();
  }

  @Get("integration")
  getIntegration() {
    return this.marketsService.getIntegrationConfig();
  }

  @Put("integration")
  updateIntegration(@Body() dto: UpdateMarketsIntegrationDto) {
    return this.marketsService.updateIntegrationConfig(dto);
  }
}
