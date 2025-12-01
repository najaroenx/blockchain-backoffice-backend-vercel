import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import {
  CreateBurnTransactionBodyDto,
  CreateMintTransactionBodyDto,
  CreateTransactionBodyDto,
  CreateTransactionC2CBodyDto,
} from '../dtos';
// import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { GetTransactionsByCustomerId } from '../handlers/getTransactionsByCustomerId.handler';
import { GetTransactionsByMerchantId } from '../handlers/getTransactionsByMerchantId.handler';
import { CreateTransactionB2C } from '../handlers/createTransactionB2C.handler';
import { CreateTransactionC2C } from '../handlers/createTransactionC2C.handler';
import { MintTransaction } from '../handlers/mintTransaction.handler';
import { BurnTransaction } from '../handlers/burnTransaction.handler';
import { GetWalletBalance } from '../handlers/getMerchantBalance.handler';
import { Public } from 'src/modules/auth/public.decorator';

@ApiTags('Transaction')
@Controller('/:merchantId/transaction')
export class TransactionController {
  constructor(
    private readonly getTransactionsByCustomerId: GetTransactionsByCustomerId,
    private readonly getTransactionsByMerchantId: GetTransactionsByMerchantId,
    private readonly createTransactionB2C: CreateTransactionB2C,
    private readonly createTransactionC2C: CreateTransactionC2C,
    private readonly mintTransaction: MintTransaction,
    private readonly burnTransaction: BurnTransaction,
    private readonly getWalletBalance: GetWalletBalance,
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

  @Get('/:walletAddress/:pointId/balance')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Wallet Balance',
    description: 'ดึงข้อมูลยอดคงเหลือของคะแนนในกระเป๋าเงิน',
  })
  @ApiParam({
    name: 'walletAddress',
    description: 'Wallet address ของลูกค้า',
    example: '0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E',
  })
  @ApiParam({
    name: 'pointId',
    description: 'รหัสคะแนน',
    example: 'cmiimp4g400015v01nv1ij7zf',
  })
  @ApiResponse({
    status: 200,
    description: 'Balance retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Wallet or Point not found',
  })
  async getWalletBalanceForPoint(
    @Param('walletAddress') walletAddress: string,
    @Param('pointId') pointId: string,
  ) {
    return this.getWalletBalance.execute(pointId, walletAddress);
  }

  @Post('/:pointId')
  @Public()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Send Point B2C',
    description: 'ส่งคะแนนให้ลูกค้า (Business to Customer)',
  })
  @ApiHeader({
    name: 'x-api-key',
    description: 'API Key สำหรับ authentication',
    required: true,
    example: 'LEk8YLySHJdMD_nD0cw5',
  })
  @ApiParam({
    name: 'merchantId',
    description: 'รหัสร้านค้า',
    example: 'cmih1s6qu00050i01m3cactjj',
  })
  @ApiParam({
    name: 'pointId',
    description: 'รหัสคะแนน',
    example: 'cmiimp4g400015v01nv1ij7zf',
  })
  @ApiBody({
    description: 'Transaction details',
    schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          example: 10,
          description: 'จำนวนคะแนนที่ต้องการส่ง',
        },
        receiverPhone: {
          type: 'string',
          example: '0984360421',
          description: 'เบอร์โทรศัพท์ของผู้รับ',
        },
      },
      required: ['amount', 'receiverPhone'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Transaction completed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid parameters',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer or Point not found',
  })
  async transaction(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateTransactionBodyDto,
  ) {
    return this.createTransactionB2C.execute(merchantId, pointId, body);
  }

  @Post('/:pointId/customer')
  @HttpCode(201)
  async transactionC2C(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateTransactionC2CBodyDto,
  ) {
    return this.createTransactionC2C.execute(merchantId, pointId, { ...body });
  }

  @Post('/:pointId/mint')
  @HttpCode(201)
  async mintTokens(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateMintTransactionBodyDto,
  ) {
    return this.mintTransaction.execute(merchantId, pointId, body);
  }

  @Post('/:pointId/burn')
  @HttpCode(201)
  async burnTokens(
    @Param('merchantId') merchantId: string,
    @Param('pointId') pointId: string,
    @Body() body: CreateBurnTransactionBodyDto,
  ) {
    return this.burnTransaction.execute(merchantId, pointId, { ...body });
  }
}
