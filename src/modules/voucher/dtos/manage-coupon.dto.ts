import {
  IsNumber,
  IsPositive,
  Min,
  IsString,
  IsOptional,
  IsDateString,
} from 'class-validator';

export class UpdateVoucherCodesPointCostDto {
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

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
