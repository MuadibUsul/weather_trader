import { IsOptional, IsString } from "class-validator";

export class StartStrategyDto {
  @IsOptional()
  @IsString()
  strategyId?: string;

  @IsOptional()
  @IsString()
  walletId?: string;
}

