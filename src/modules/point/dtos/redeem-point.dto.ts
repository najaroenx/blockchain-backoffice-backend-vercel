import { IsNumber, IsString } from 'class-validator';

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
