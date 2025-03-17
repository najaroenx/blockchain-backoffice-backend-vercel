import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  CreateBurnTransactionBodyDto,
  CreateMintTransactionBodyDto,
  CreateTransactionBodyDto,
  CreateTransactionC2CBodyDto,
} from '../dtos';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { GetTransactionsByCustomerId } from '../handlers/getTransactionsByCustomerId.handler';
import { GetTransactionsByMerchantId } from '../handlers/getTransactionsByMerchantId.handler';
import { CreateTransactionB2C } from '../handlers/createTransactionB2C.handler';
import { CreateTransactionC2C } from '../handlers/createTransactionC2C.handler';
import { MintTransaction } from '../handlers/mintTransaction.handler';
import { BurnTransaction } from '../handlers/burnTransaction.handler';
@Controller('/:merchantId/transaction')
export class TransactionController {
  constructor(
    private readonly getTransactionsByCustomerId: GetTransactionsByCustomerId,
    private readonly getTransactionsByMerchantId: GetTransactionsByMerchantId,
    private readonly createTransactionB2C: CreateTransactionB2C,
    private readonly createTransactionC2C: CreateTransactionC2C,
    private readonly mintTransaction: MintTransaction,
    private readonly burnTransaction: BurnTransaction,
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

  @Post('/:pointId')
  @HttpCode(201)
  async transaction(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateTransactionBodyDto,
  ) {
    return this.createTransactionB2C.execute(merchantId, pointId, {
      ...body,
      senderAddress: createBufferFromHex(body.senderAddress),
    });
  }

  @Post('/:pointId/customer')
  @HttpCode(201)
  async transactionC2C(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateTransactionC2CBodyDto,
  ) {
    return this.createTransactionC2C.execute(merchantId, pointId, {
      ...body,
    });
  }

  @Post('/:pointId/mint')
  @HttpCode(201)
  async mintTokens(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateMintTransactionBodyDto,
  ) {
    return this.mintTransaction.execute(merchantId, pointId, {
      ...body,
      senderAddress: createBufferFromHex(body.senderAddress),
    });
  }

  @Post('/:pointId/burn')
  @HttpCode(201)
  async burnTokens(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateBurnTransactionBodyDto,
  ) {
    return this.burnTransaction.execute(merchantId, pointId, {
      ...body,
    });
  }
}
