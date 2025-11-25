import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  IsDateString,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VoucherStatus, VoucherValueType } from '@prisma/client';

export class CreateVoucherDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsEnum(VoucherStatus)
  status: VoucherStatus;

  @IsString()
  @IsOptional()
  merchantId?: string;

  @IsEnum(VoucherValueType)
  valueType: VoucherValueType;

  @IsNumber()
  value: number;

  @IsInt()
  pointsCost: number;

  @IsString()
  @IsNotEmpty()
  pointId: string; // Point ID to specify which point currency to use

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsInt()
  totalIssued: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsInt()
  @IsOptional()
  limitPerMember?: number;

  @IsString()
  @IsNotEmpty()
  merchantRef: string; // ← Reference ID from merchant system for verification
}

export class UpdateVoucherDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(VoucherStatus)
  @IsOptional()
  status?: VoucherStatus;

  @IsEnum(VoucherValueType)
  @IsOptional()
  valueType?: VoucherValueType;

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsInt()
  @IsOptional()
  pointsCost?: number;

  @IsString()
  @IsOptional()
  pointId?: string; // Point ID to specify which point currency to use

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @IsOptional()
  totalIssued?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsInt()
  @IsOptional()
  limitPerMember?: number;

  @IsString()
  @IsOptional()
  merchantRef?: string; // ร้านที่เป็นเจ้าของคูปองที่นำไปแลก
}

// DTO for voucher sale creation
export class CreateVoucherByDevDto {
  @IsString()
  @IsNotEmpty()
  sellerWalletAddress: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @ValidateNested()
  @Type(() => CreateVoucherDto)
  coupon: CreateVoucherDto;
}
