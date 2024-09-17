import { IsNumber, IsString } from 'class-validator';

export class GetPointDto {
  @IsString()
  pointId: string;
}

export class GetPointsDto {
  @IsString()
  merchantId: string;
}
export class CreatePointDto {
  @IsString()
  name: string;

  @IsString()
  symbol: string;

  @IsString()
  merchantId: string;

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
