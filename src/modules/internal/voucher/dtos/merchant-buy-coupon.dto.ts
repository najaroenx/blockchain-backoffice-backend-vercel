import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class MerchantBuyCouponFromSellerDto {
  @IsString()
  @IsNotEmpty()
  listingId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsNotEmpty()
  merchantId: string;
}
