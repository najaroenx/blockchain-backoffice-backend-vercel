import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsArray,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BatchTransferItemDto {
  @ApiProperty({
    description: 'The phone number of the target customer',
    example: '0809760286',
  })
  @IsNotEmpty()
  @IsString()
  customerPhone: string;

  @ApiProperty({
    description: 'The ID of the voucher type to transfer',
    example: 'COUPON-95ed24b5-116f-46b7-9072-4b3287acce98',
  })
  @IsNotEmpty()
  @IsString()
  voucherId: string;

  @ApiProperty({
    description: 'Quantity of coupons to transfer',
    example: 1,
    default: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class BatchTransferVoucherDto {
  @ApiProperty({
    description: 'The ID of the merchant initiating the batch transfer',
    example: 'cmmxc3v760003ze01xotjyeot',
  })
  @IsNotEmpty()
  @IsString()
  merchantId: string;

  @ApiProperty({
    description:
      'List of transfer task details containing customer and voucher records',
    type: [BatchTransferItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchTransferItemDto)
  @ArrayMinSize(1)
  transfers: BatchTransferItemDto[];
}
