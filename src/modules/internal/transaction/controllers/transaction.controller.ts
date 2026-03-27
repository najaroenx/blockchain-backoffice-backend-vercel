import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { CreateTransactionBodyDto } from '../dtos';
import { GetTransactionsByCustomerId } from '../handlers/getTransactionsByCustomerId.handler';
import { GetTransactionsByMerchantId } from '../handlers/getTransactionsByMerchantId.handler';
import { GetPointTransactionsByCustomerPhone } from '../handlers/getPointTransactionsByCustomerPhone.handler';
import { GetVoucherTransactionsByCustomerPhone } from '../handlers/getVoucherTransactionsByCustomerPhone.handler';
import { CreateTransactionB2C } from '../handlers/createTransactionB2C.handler';
import { GetWalletBalance } from '../handlers/getMerchantBalance.handler';
import { Public } from 'src/modules/internal/auth/public.decorator';

@ApiTags('Transaction')
@Controller('/:merchantId/transaction')
export class TransactionController {
  constructor(
    private readonly getTransactionsByCustomerId: GetTransactionsByCustomerId,
    private readonly getTransactionsByMerchantId: GetTransactionsByMerchantId,
    private readonly getPointTransactionsByCustomerPhone: GetPointTransactionsByCustomerPhone,
    private readonly getVoucherTransactionsByCustomerPhone: GetVoucherTransactionsByCustomerPhone,
    private readonly createTransactionB2C: CreateTransactionB2C,
    private readonly getWalletBalance: GetWalletBalance,
  ) {}

  @Get('/')
  @Public()
  @HttpCode(200)
  async getTransactions(@Param('merchantId') merchantId: string) {
    return this.getTransactionsByMerchantId.execute(merchantId);
  }

  @Get('/all')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get All Transactions by Merchant',
    description: 'ดึงธุรกรรมทั้งหมดของร้านค้าตาม merchantId',
  })
  @ApiParam({
    name: 'merchantId',
    description: 'รหัสร้านค้า',
    example: 'cmih1s6qu00050i01m3cactjj',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction history retrieved successfully',
  })
  async getAllTransactions(@Param('merchantId') merchantId: string) {
    return this.getTransactionsByMerchantId.execute(merchantId);
  }

  @Get('/customer/phone/:phone/points')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Point Transaction History by Customer Phone',
    description:
      'ดึงประวัติธุรกรรม Point เท่านั้น (ไม่รวม voucher) ของลูกค้าด้วยเบอร์โทรศัพท์',
  })
  @ApiParam({
    name: 'merchantId',
    description: 'รหัสร้านค้า',
    example: 'cmih1s6qu00050i01m3cactjj',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Point transaction history retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getPointTransactionsCustomer(
    @Param('merchantId') merchantId: string,
    @Param('phone') phone: string,
  ) {
    return this.getPointTransactionsByCustomerPhone.execute(merchantId, phone);
  }

  @Get('/customer/phone/:phone/coupons')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Voucher Transaction History by Customer Phone',
    description:
      'ดึงประวัติธุรกรรม Voucher เท่านั้น (ไม่รวม point) ของลูกค้าด้วยเบอร์โทรศัพท์',
  })
  @ApiParam({
    name: 'merchantId',
    description: 'รหัสร้านค้า',
    example: 'cmih1s6qu00050i01m3cactjj',
  })
  @ApiParam({
    name: 'phone',
    description: 'เบอร์โทรศัพท์ของลูกค้า (10 digits)',
    example: '0984360421',
  })
  @ApiResponse({
    status: 200,
    description: 'Voucher transaction history retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found',
  })
  async getVoucherTransactionsCustomer(
    @Param('merchantId') merchantId: string,
    @Param('phone') phone: string,
  ) {
    return this.getVoucherTransactionsByCustomerPhone.execute(
      merchantId,
      phone,
    );
  }

  @Get('/:customerId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get Transaction History by Customer ID',
    description: 'ดึงประวัติธุรกรรมของลูกค้าในร้านค้านั้นๆด้วย Customer ID',
  })
  @ApiParam({
    name: 'merchantId',
    description: 'รหัสร้านค้า',
    example: 'cmih1s6qu00050i01m3cactjj',
  })
  @ApiParam({
    name: 'customerId',
    description: 'รหัสลูกค้า (Customer ID)',
    example: 'cmiisvgqn0007xk01efv8szbq',
  })
  async getTransactionsByCustomer(
    @Param('merchantId') merchantId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.getTransactionsByCustomerId.executeByCustomerId(
      merchantId,
      customerId,
    );
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
        phone: {
          type: 'string',
          example: '0984360421',
          description: 'เบอร์โทรศัพท์ของผู้รับ',
        },
        transactionTypeId: {
          type: 'string',
          example: 'TRANSFER',
          description: 'ประเภทธุรกรรม (optional, default: TRANSFER)',
        },
        eventId: {
          type: 'string',
          example: 'event_12345',
          description: 'รหัสอีเว้นท์สำหรับติดตามธุรกรรม (optional)',
        },
      },
      required: ['amount', 'phone'],
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
}
