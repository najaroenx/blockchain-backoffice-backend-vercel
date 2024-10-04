import { IsNumber, IsString } from 'class-validator';

export class CreateTransactionBodyDto {
  @IsString()
  transactionTypeId: string;

  @IsString()
  senderAddress: string;

  @IsString()
  receiverAddress: string;

  @IsNumber()
  amount: number;
}
