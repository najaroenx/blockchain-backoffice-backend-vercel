import { IsEmail, IsNumber, IsString } from 'class-validator';

export class CreateTransactionBodyDto {
  @IsString()
  transactionTypeId: string;

  @IsString()
  senderAddress: string;

  @IsEmail()
  email: string;

  @IsNumber()
  amount: number;
}

export class CreateTransactionC2CBodyDto {
  @IsEmail()
  toEmail: string;

  @IsEmail()
  fromEmail: string;

  @IsNumber()
  amount: number;
}

export class CreateMintTransactionBodyDto extends CreateTransactionBodyDto {}

export class CreateBurnTransactionBodyDto {
  @IsEmail()
  fromEmail: string;

  @IsNumber()
  amount: number;
}
