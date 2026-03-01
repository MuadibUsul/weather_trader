import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateMarketsIntegrationDto {
  @IsOptional()
  @IsString()
  exchangeUrl?: string;

  @IsOptional()
  @IsString()
  tagSlug?: string;

  @IsOptional()
  @IsInt()
  @Min(6)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1500)
  @Max(30000)
  timeoutMs?: number;
}

