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
  frameSize: number;

  @IsNumber()
  slotSize: number;
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
  frameSize?: number;

  @IsNumber()
  @IsOptional()
  slotSize?: number;

  @IsString()
  @IsOptional()
  contractAddress?: string;
}
