import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateWalletDto {
  @IsString()
  label!: string;

  @IsString()
  address!: string;

  @IsNumber()
  @Min(0)
  balance!: number;

  @IsString()
  unit!: string;

  @IsBoolean()
  connected!: boolean;

  @IsBoolean()
  isSimulated!: boolean;

  @IsOptional()
  @IsIn(["SIMULATED", "PLUGIN_SIGNATURE", "PRIVATE_KEY", "MANUAL"])
  bindingMethod?: "SIMULATED" | "PLUGIN_SIGNATURE" | "PRIVATE_KEY" | "MANUAL";

  @IsOptional()
  @IsString()
  boundAt?: string | null;
}
