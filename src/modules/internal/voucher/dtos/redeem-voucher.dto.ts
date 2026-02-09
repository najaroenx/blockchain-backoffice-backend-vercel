import { IsString, IsNotEmpty } from 'class-validator';

export class RedeemVoucherDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsString()
  @IsNotEmpty()
  code: string; // ← เปลี่ยนจาก redeemCode เป็น code จาก VoucherCode table
}

export class RedeemAISVoucherDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  merchantRef: string;

  @IsString()
  @IsNotEmpty()
  receiverPhone: string; // เบอร์โทรศัพท์ของผู้รับ point จาก AIS
}
