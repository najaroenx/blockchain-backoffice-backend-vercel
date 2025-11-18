import { IsNotEmpty, IsString } from 'class-validator';

export class BuyCouponFromMarketplaceDto {
  @IsNotEmpty()
  @IsString()
  voucherGroupId: string;

  @IsNotEmpty()
  @IsString()
  pointId: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  phone: string;
}
