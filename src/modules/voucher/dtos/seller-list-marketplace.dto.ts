import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  IsOptional,
} from 'class-validator';

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

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
