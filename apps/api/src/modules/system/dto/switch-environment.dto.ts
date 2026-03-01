import { IsBoolean, IsIn, IsString, Length } from "class-validator";

export class SwitchEnvironmentDto {
  @IsIn(["REAL", "PAPER"])
  target!: "REAL" | "PAPER";

  @IsString()
  @Length(6, 6)
  pin!: string;

  @IsBoolean()
  acknowledged!: boolean;
}
