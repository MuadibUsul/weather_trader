import { Module } from "@nestjs/common";
import { ControlModule } from "../control/control.module";
import { MarketsModule } from "../markets/markets.module";
import { SystemModule } from "../system/system.module";
import { ExecutionApplicationService } from "./execution-application.service";

@Module({
  imports: [SystemModule, ControlModule, MarketsModule],
  providers: [ExecutionApplicationService],
  exports: [ExecutionApplicationService],
})
export class ExecutionModule {}

