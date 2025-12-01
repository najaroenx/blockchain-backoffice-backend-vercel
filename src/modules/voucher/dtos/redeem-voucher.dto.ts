import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class RedeemVoucherDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  code: string; // ← เปลี่ยนจาก redeemCode เป็น code จาก VoucherCode table

  @IsString()
  @IsOptional()
  eventId?: string; // Event ID for tracking redemption events
}
