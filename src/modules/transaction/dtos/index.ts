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
