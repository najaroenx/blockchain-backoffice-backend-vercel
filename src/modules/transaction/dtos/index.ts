import { IsNumber, IsString } from 'class-validator';

export class CreateTransactionBodyDto {
  @IsString()
  transactionTypeId: string;

  @IsString()
  phone: string;

  @IsNumber()
  amount: number;
}

export class CreateTransactionC2CBodyDto {
  @IsString()
  toPhone: string;

  @IsString()
  fromPhone: string;

  @IsNumber()
  amount: number;
}

export class CreateMintTransactionBodyDto {
  @IsString()
  transactionTypeId: string;

  @IsString()
  phone: string;

  @IsNumber()
  amount: number;
}

export class CreateBurnTransactionBodyDto {
  @IsString()
  fromPhone: string;

  @IsNumber()
  amount: number;
}
