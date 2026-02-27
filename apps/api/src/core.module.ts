import { Global, Module } from "@nestjs/common";
import { EventsGateway } from "./gateway/events.gateway";
import { PrismaService } from "./prisma.service";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [PrismaService, RedisService, EventsGateway],
  exports: [PrismaService, RedisService, EventsGateway],
})
export class CoreModule {}

