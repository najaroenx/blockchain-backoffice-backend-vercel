import { IsNotEmpty, IsString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferVoucherToCustomerDto {
  @ApiProperty({
    description: 'The ID of the merchant initiating the transfer',
    example: 'cmmcbdhqy0003zw01kwo309qa',
  })
  @IsNotEmpty()
  @IsString()
  merchantId: string;

  @ApiProperty({
    description: 'The phone number of the target customer',
    example: '0809760286',
  })
  @IsNotEmpty()
  @IsString()
  customerPhone: string;

  @ApiProperty({
    description: 'The ID of the voucher type to transfer',
    example: 'COUPON-ce969227-df68-429e-a1f3-aeb53a30b165',
  })
  @IsNotEmpty()
  @IsString()
  voucherId: string;

  @ApiProperty({
    description: 'Quantity of coupons to transfer',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
