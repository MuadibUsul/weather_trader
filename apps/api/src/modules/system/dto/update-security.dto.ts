import { IsBoolean, IsOptional, Matches } from "class-validator";

export class UpdateSecurityDto {
  @IsBoolean()
  mfaEnabled!: boolean;

  @IsOptional()
  @Matches(/^\d{6}$/)
  newTradePin?: string;

  @IsOptional()
  @Matches(/^\d{6}$/)
  emailCode?: string;
}
