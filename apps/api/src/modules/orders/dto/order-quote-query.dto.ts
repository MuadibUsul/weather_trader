import { IsIn, IsOptional, IsString } from "class-validator";

export class OrderQuoteQueryDto {
  @IsString()
  marketId!: string;

  @IsOptional()
  @IsIn(["REAL", "PAPER"])
  environment?: "REAL" | "PAPER";
}

