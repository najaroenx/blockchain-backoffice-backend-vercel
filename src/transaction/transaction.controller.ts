import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  CreateTransactionDto,
  CreateTransactionDtoBodyDto,
  GetTransactionsDto,
} from './dto';
import { TransactionService } from './transaction.service';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';

@Controller('/:merchantId/transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get('/')
  @HttpCode(200)
  async getPoints(@Param() params: GetTransactionsDto) {
    const { merchantId } = params;
    return this.transactionService.getTransactionsByMerchatId(merchantId);
  }

  @Post('/:pointId')
  @HttpCode(201)
  async transaction(
    @Param() params: CreateTransactionDto,
    @Body() body: CreateTransactionDtoBodyDto,
  ) {
    const { merchantId, pointId } = params;

    return this.transactionService.createTransaction(merchantId, pointId, {
      ...body,
      senderAddress: createBufferFromHex(body.senderAddress),
      receiverAddress: createBufferFromHex(body.receiverAddress),
    });
  }
}
