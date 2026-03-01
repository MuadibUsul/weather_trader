import { Module } from "@nestjs/common";
import { ControlModule } from "../control/control.module";
import { MarketsModule } from "../markets/markets.module";
import { EnvController } from "./env.controller";
import { SystemController } from "./system.controller";
import { SystemService } from "./system.service";

@Module({
  imports: [MarketsModule, ControlModule],
  controllers: [SystemController, EnvController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
