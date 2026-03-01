import { IsString } from "class-validator";

export class BindPrivateKeyWalletDto {
  @IsString()
  privateKey!: string;
}
