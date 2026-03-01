import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateCredentialDto {
  @IsOptional()
  @IsString()
  keyName!: string;

  @IsOptional()
  @IsBoolean()
  healthy!: boolean;

  @IsOptional()
  @IsString()
  lastHeartbeat!: string;

  @IsOptional()
  @IsString()
  scope!: string;
}
