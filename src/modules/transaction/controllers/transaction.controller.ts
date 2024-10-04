import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CreateTransactionBodyDto } from '../dtos';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { GetTransactionsByCustomerId } from '../handlers/getTransactionsByCustomerId.handler';
import { GetTransactionsByMerchantId } from '../handlers/getTransactionsByMerchantId.handler';
import { CreateTransaction } from '../handlers/createTransaction.handler';

@Controller('/:merchantId/transaction')
export class TransactionController {
  constructor(
    private readonly getTransactionsByCustomerId: GetTransactionsByCustomerId,
    private readonly getTransactionsByMerchantId: GetTransactionsByMerchantId,
    private readonly createTransaction: CreateTransaction,
  ) {}

  @Get('/')
  @HttpCode(200)
  async getTransactions(@Param('merchantId') merchantId: string) {
    return this.getTransactionsByMerchantId.execute(merchantId);
  }

  @Get('/:customerId')
  @HttpCode(200)
  async getTransactionsByCustomer(
    @Param('merchantId') merchantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.getTransactionsByCustomerId.execute(customerId, merchantId);
  }

  // TODO : split out for merchant and customer (B2C, C2C)
  @Post('/:pointId')
  @HttpCode(201)
  async transaction(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateTransactionBodyDto,
  ) {
    return this.createTransaction.execute(merchantId, pointId, {
      ...body,
      senderAddress: createBufferFromHex(body.senderAddress),
      receiverAddress: createBufferFromHex(body.receiverAddress),
    });
  }
}
