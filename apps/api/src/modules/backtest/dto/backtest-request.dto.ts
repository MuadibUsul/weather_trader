import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

export class CandleInputDto {
  @IsInt()
  ts!: number;

  @IsString()
  symbol!: string;

  @IsNumber()
  open!: number;

  @IsNumber()
  high!: number;

  @IsNumber()
  low!: number;

  @IsNumber()
  close!: number;

  @IsOptional()
  @IsNumber()
  volume?: number;
}

export class RiskInputDto {
  @IsNumber()
  @Min(0)
  maxDrawdownPct = 20;

  @IsNumber()
  @Min(1)
  maxPositionPerSymbol = 10000;

  @IsNumber()
  @Min(1)
  maxNotionalPerTrade = 100000;
}

export class StrategyInputDto {
  @IsIn(["threshold"]) 
  type: "threshold" = "threshold";

  @IsOptional()
  @IsNumber()
  buyBelow = 0.45;

  @IsOptional()
  @IsNumber()
  sellAbove = 0.75;

  @IsOptional()
  @IsNumber()
  quantity = 100;
}

export class BacktestRequestDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  initialCash = 10000;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeRate = 0.001;

  @IsOptional()
  @IsInt()
  @Min(0)
  slippageBps = 10;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CandleInputDto)
  candles!: CandleInputDto[];

  @ValidateNested()
  @Type(() => RiskInputDto)
  risk: RiskInputDto = new RiskInputDto();

  @ValidateNested()
  @Type(() => StrategyInputDto)
  strategy: StrategyInputDto = new StrategyInputDto();
}
