import { IsString, IsNumber, IsPositive, Min } from 'class-validator';

export class UpdateVoucherCodesPointCostDto {
  @IsString()
  voucherId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class UpdateAllVoucherCodesPointCostDto {
  @IsNumber()
  @Min(0)
  price: number;
}
