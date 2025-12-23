import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePointDto {
  @IsString()
  name: string;

  @IsString()
  symbol: string;

  @IsNumber()
  initialSupply: number;

  @IsNumber()
  decimal: number;

  @IsNumber()
  @IsOptional()
  startDate?: number; // Unix timestamp วันเริ่มต้น (optional)

  @IsNumber()
  @IsOptional()
  endDate?: number; // Unix timestamp วันหมดอายุ - กำหนดวันเอง

  @IsNumber()
  @IsOptional()
  expiryMonths?: number; // จำนวนเดือน (3, 6, 9, 12, 24) - เลือกระยะเวลา

  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class RedeemPointsDto {
  @IsString()
  merchantId: string;

  @IsString()
  pointId: string;
}

export class RedeemPointBodyDto {
  @IsString()
  transactionTypeId: string;

  @IsString()
  receiverAddress: string;

  @IsNumber()
  amount: number;

  @IsString()
  email: string;
}

export class UpdatePointDto {
  @IsNumber()
  @IsOptional()
  startDate?: number; // Unix timestamp วันเริ่มต้น

  @IsNumber()
  @IsOptional()
  endDate?: number; // Unix timestamp วันหมดอายุ

  @IsNumber()
  @IsOptional()
  expiryMonths?: number; // จำนวนเดือน (3, 6, 9, 12, 24)

  @IsString()
  @IsOptional()
  imageUrl?: string; // URL รูปภาพ

  @IsString()
  @IsOptional()
  contractAddress?: string;
}

export class DeletePointParams {
  @IsString()
  id: string;

  @IsString()
  merchantId: string;
}

export class GetPointByIdParams {
  @IsString()
  pointId: string;
}
