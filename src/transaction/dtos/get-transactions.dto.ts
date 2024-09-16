import { IsString } from 'class-validator';

export class GetTransactionsDto {
  @IsString()
  merchantId: string;
}
