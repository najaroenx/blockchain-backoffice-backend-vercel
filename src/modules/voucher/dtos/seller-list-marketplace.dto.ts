import { IsNotEmpty, IsString, IsNumber, Min } from 'class-validator';

export class SellerListOnMarketplaceDto {
  @IsString()
  @IsNotEmpty()
  voucherId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsNumber()
  @Min(0)
  pricePerUnitTHB: number;

  @IsString()
  @IsNotEmpty()
  sellerWalletAddress: string;
}
