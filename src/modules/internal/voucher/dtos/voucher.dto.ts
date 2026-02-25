import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  IsDateString,
  ValidateNested,
  IsNotEmpty,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VoucherStatus, VoucherValueType } from '@prisma/client';

@ValidatorConstraint({ name: 'aisPointMaxValue', async: false })
export class AisPointMaxValueConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: any, args: ValidationArguments) {
    const obj = args.object as any;
    if (obj.valueType === 'aispoint' && obj.value !== undefined) {
      return obj.value <= 100;
    }
    return true;
  }

  defaultMessage() {
    return 'AIS Point voucher value must not exceed 100';
  }
}

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
  @Validate(AisPointMaxValueConstraint)
  value: number;

  @IsInt()
  @IsOptional()
  pointsCost?: number; // Optional: merchant sets this during activation

  @IsString()
  @IsOptional()
  pointId?: string; // Optional: merchant sets this during activation

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
  @IsOptional()
  merchantRef?: string; // Optional: Reference ID from merchant/seller system
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
  @Validate(AisPointMaxValueConstraint)
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

// DTO for voucher sale creation (seller creates voucher inventory)
export class CreateVoucherByDevDto {
  @ValidateNested()
  @Type(() => CreateVoucherDto)
  coupon: CreateVoucherDto;
}
