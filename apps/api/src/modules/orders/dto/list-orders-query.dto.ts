import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(["REAL", "PAPER"])
  environment?: "REAL" | "PAPER";

  @IsOptional()
  @IsIn(["filled", "open", "cancelled"])
  status?: "filled" | "open" | "cancelled";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page?: number;
}
