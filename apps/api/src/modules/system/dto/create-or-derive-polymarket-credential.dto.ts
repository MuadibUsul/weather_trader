import { IsIn, IsInt, IsString, Min } from "class-validator";

export class CreateOrDerivePolymarketCredentialDto {
  @IsString()
  host!: string;

  @IsInt()
  @Min(1)
  chainId!: number;

  @IsInt()
  @IsIn([0, 1, 2])
  signatureType!: 0 | 1 | 2;

  @IsString()
  funder!: string;

  @IsString()
  privateKey!: string;
}
