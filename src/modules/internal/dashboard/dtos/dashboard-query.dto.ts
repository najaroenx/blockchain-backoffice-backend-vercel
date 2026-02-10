import { Transform } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string; // Default: start of current month

  @IsOptional()
  @IsDateString()
  endDate?: string; // Default: today

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => {
    // Support both ?couponIds=id1,id2 and ?couponIds=id1&couponIds=id2
    if (typeof value === 'string') {
      return value.split(',').map((id) => id.trim());
    }
    return value;
  })
  couponIds?: string[]; // Filter by specific voucher/coupon IDs

  @IsOptional()
  @IsString()
  marketerMerchantId?: string; // Filter coupons by marketer who purchased them
}
