import { IsString, IsNotEmpty } from 'class-validator';

export class RedeemVoucherDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  code: string; // ← เปลี่ยนจาก redeemCode เป็น code จาก VoucherCode table
}
