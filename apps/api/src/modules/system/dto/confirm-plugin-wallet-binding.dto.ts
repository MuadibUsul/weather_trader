import { IsString } from "class-validator";

export class ConfirmPluginWalletBindingDto {
  @IsString()
  address!: string;

  @IsString()
  signature!: string;
}
