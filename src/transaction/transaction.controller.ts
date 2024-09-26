import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CreateTransactionBodyDto } from './dto';
import { TransactionService } from './transaction.service';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';

@Controller('/:merchantId/transaction')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get('/')
  @HttpCode(200)
  async getTransactions(@Param('merchantId') merchantId: string) {
    return this.transactionService.getTransactionsByMerchatId(merchantId);
  }

  @Get('/:customerId')
  @HttpCode(200)
  async getTransactionsByCustomerId(
    @Param('merchantId') merchantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.transactionService.getTransactionsByCustomerId(
      customerId,
      merchantId,
    );
  }

  // TODO : split out for merchant and customer (B2C, C2C)
  @Post('/:pointId')
  @HttpCode(201)
  async transaction(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateTransactionBodyDto,
  ) {
    return this.transactionService.createTransaction(merchantId, pointId, {
      ...body,
      senderAddress: createBufferFromHex(body.senderAddress),
      receiverAddress: createBufferFromHex(body.receiverAddress),
    });
  }
}
