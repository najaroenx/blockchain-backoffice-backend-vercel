import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { GetTransactionsDto } from './dtos';
import { TransactionService } from './transaction.service';

@Controller('transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get('/:merchantId')
  @HttpCode(200)
  async getPoints(@Param() params: GetTransactionsDto) {
    const { merchantId } = params;
    return this.transactionService.getTransactionsByMerchatId(merchantId);
  }
}
