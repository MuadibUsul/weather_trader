import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateOrderDto {
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

  @IsString()
  @IsOptional()
  environment?: "REAL" | "PAPER";
}

