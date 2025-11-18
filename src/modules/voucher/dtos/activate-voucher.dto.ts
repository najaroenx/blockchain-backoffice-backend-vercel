import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class ActivateVoucherDto {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  amount: number;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  pointsCost: number;

  @IsString()
  @IsNotEmpty()
  pointId: string; // Point ID to use for this voucher batch

  @IsString()
  @IsNotEmpty()
  currency: string; // Currency symbol (must match Point.symbol)
}
