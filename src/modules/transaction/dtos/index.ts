import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTransactionBodyDto {
  @IsString()
  @IsOptional()
  transactionTypeId?: string;

  @IsString()
  phone: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  eventId?: string;
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
