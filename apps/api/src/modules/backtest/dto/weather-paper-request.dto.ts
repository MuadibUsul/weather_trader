import { IsIn, IsNumber, IsOptional, Max, Min } from "class-validator";

export class WeatherPaperRequestDto {
  @IsOptional()
  @IsNumber()
  @Min(100)
  initialCash = 10000;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(0.05)
  feeRate = 0.001;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  slippageBps = 10;

  @IsOptional()
  @IsIn(["mid", "depth"])
  matchingModel: "mid" | "depth" = "depth";

  @IsOptional()
  @IsIn(["deterministic_l2", "stochastic_impact", "both"])
  paperModel: "deterministic_l2" | "stochastic_impact" | "both" = "deterministic_l2";

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2147483647)
  seed = 42;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  edgeThreshold = 0.03;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence = 0.5;

  @IsOptional()
  @IsNumber()
  @Min(10)
  orderNotional = 150;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(30)
  marketLimit = 6;

  @IsOptional()
  @IsNumber()
  @Min(600)
  @Max(86400)
  fidelitySec = 3600;

  @IsOptional()
  @IsNumber()
  @Min(0.001)
  @Max(0.2)
  syntheticSpread = 0.02;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(200000)
  syntheticDepth = 2500;
}
