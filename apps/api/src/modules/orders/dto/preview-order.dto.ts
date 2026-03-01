import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class PreviewOrderDto {
  @IsString()
  marketId!: string;

  @IsIn(["buy", "sell"])
  side!: "buy" | "sell";

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  price!: number;

  @IsOptional()
  @IsIn(["REAL", "PAPER"])
  environment?: "REAL" | "PAPER";

  @IsOptional()
  @IsString()
  strategyId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  slippageBps?: number;
}

