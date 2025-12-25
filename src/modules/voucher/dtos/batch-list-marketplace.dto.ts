import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchListItemDto {
  @IsString()
  @IsNotEmpty()
  voucherId: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsNumber()
  @Min(0)
  pricePerUnitTHB: number;
}

export class BatchListOnMarketplaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchListItemDto)
  @ArrayMinSize(1)
  items: BatchListItemDto[];

  @IsString()
  @IsNotEmpty()
  sellerWalletAddress: string;
}
