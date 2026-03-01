import { IsString } from "class-validator";

export class RequestPluginWalletChallengeDto {
  @IsString()
  address!: string;
}
