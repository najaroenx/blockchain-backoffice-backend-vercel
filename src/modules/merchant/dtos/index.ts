import { IsOptional, IsString, IsInt, IsArray } from 'class-validator';

export class CreateMerchantDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsInt()
  @IsOptional()
  points?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  website: string;

  @IsArray()
  @IsOptional()
  voucherIds?: string[];

  @IsString()
  tel: string;

  @IsString()
  @IsOptional()
  walletId?: string;

  @IsString()
  userId: string;
}

export class UpdateMerchantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsInt()
  @IsOptional()
  points?: number;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsArray()
  @IsOptional()
  voucherIds?: string[];

  @IsString()
  @IsOptional()
  tel?: string;

  @IsString()
  @IsOptional()
  walletId?: string;
}
