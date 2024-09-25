import { IsNumber, IsString } from 'class-validator';

export class GetTransactionsDto {
  @IsString()
  merchantId: string;
}

export class CreateTransactionDto {
  @IsString()
  merchantId: string;

  @IsString()
  pointId: string;
}

export class CreateTransactionDtoBodyDto {
  @IsString()
  transactionTypeId: string;

  @IsString()
  senderAddress: string;

  @IsString()
  receiverAddress: string;

  @IsNumber()
  amount: number;
}
