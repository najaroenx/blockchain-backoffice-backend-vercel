import { IsNotEmpty, IsString } from 'class-validator';

export class BuyCouponFromMarketplaceDto {
  @IsNotEmpty()
  @IsString()
  voucherCodeId: string;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  customerId: string;
}
