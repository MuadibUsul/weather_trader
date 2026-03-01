import { IsOptional, IsString, MaxLength } from "class-validator";

export class UnbindRealWalletDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reason?: string;
}
