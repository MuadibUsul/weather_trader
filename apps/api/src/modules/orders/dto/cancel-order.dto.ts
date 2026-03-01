import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reason?: string;
}
