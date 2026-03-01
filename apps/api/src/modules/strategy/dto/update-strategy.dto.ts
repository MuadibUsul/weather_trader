import { IsBoolean, IsIn, IsInt, IsNumber, Max, Min } from "class-validator";
import { IsOptional, IsString } from "class-validator";

export class UpdateStrategyDto {
  @IsOptional()
  @IsString()
  strategyId?: string;

  @IsIn(["mean_reversion", "trend_following"])
  model!: "mean_reversion" | "trend_following";

  @IsBoolean()
  autoTradeEnabled!: boolean;

  @IsNumber()
  @Min(0)
  @Max(1)
  triggerThreshold!: number;

  @IsInt()
  @Min(1)
  @Max(60)
  updateFrequencySec!: number;

  @IsNumber()
  @Min(0)
  maxDailyLoss!: number;

  @IsNumber()
  @Min(0)
  maxPositionSize!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  maxOpenPositions!: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  slippageBps!: number;
}
