import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import type { ApproveRealDto, RejectRealDto, RequestRealDto } from "@weather-trader/shared";
import { ControlStrategyGovernanceService } from "./control.strategy-governance.service";

@Controller("api/strategies")
export class ControlStrategyGovernanceController {
  constructor(private readonly governance: ControlStrategyGovernanceService) {}

  @Get()
  listStrategies() {
    return this.governance.listStrategies();
  }

  @Get(":id/approvals")
  approvals(@Param("id") id: string) {
    return this.governance.listApprovals(id);
  }

  @Post(":id/request_real")
  requestReal(@Param("id") id: string, @Body() body: RequestRealDto) {
    return this.governance.requestReal(id, body, "operator");
  }

  @Post(":id/approve_real")
  approveReal(@Param("id") id: string, @Body() body: ApproveRealDto) {
    return this.governance.approveReal(id, body, "risk_admin");
  }

  @Post(":id/reject_real")
  rejectReal(@Param("id") id: string, @Body() body: RejectRealDto) {
    return this.governance.rejectReal(id, body, "risk_admin");
  }
}
