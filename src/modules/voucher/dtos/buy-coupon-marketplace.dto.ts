import { IsNotEmpty, IsString } from 'class-validator';

export class BuyCouponFromMarketplaceDto {
  @IsNotEmpty()
  @IsString()
  listingId: string;

  @IsNotEmpty()
  @IsString()
  pointId: string;

  @IsNotEmpty()
  @IsString()
  phone: string;
}
