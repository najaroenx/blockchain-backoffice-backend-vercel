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
  merchantName: string;

  @IsString()
  @IsOptional()
  merchantId?: string;

  @IsEnum(VoucherValueType)
  valueType: VoucherValueType;

  @IsNumber()
  value: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  pointsCost: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsInt()
  totalIssued: number;

  @IsInt()
  totalRedeemed: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsInt()
  @IsOptional()
  limitPerMember?: number;
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

  @IsString()
  @IsOptional()
  merchantName?: string;

  @IsEnum(VoucherValueType)
  @IsOptional()
  valueType?: VoucherValueType;

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsInt()
  @IsOptional()
  pointsCost?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @IsOptional()
  totalIssued?: number;

  @IsInt()
  @IsOptional()
  totalRedeemed?: number;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsInt()
  @IsOptional()
  limitPerMember?: number;
}

// DTO for voucher sale creation
export class CreateVoucherByDevDto {
  @IsString()
  @IsNotEmpty()
  sellerWalletAddress: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsInt()
  @IsNotEmpty()
  amount: number;

  @ValidateNested()
  @Type(() => CreateVoucherDto)
  coupon: CreateVoucherDto;
}
